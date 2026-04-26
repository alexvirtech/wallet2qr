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
- CryptoJS (AES-CBC — compatibility with text2qrApp)
- qrcode + jsqr + qr-scanner (QR encode/decode)
- @lifi/sdk (cross-chain swaps)

## Security

Wallet2QR is designed as a **non-custodial** wallet-access tool. The project does not store user mnemonics, passwords, or private keys on any server. All cryptographic operations run entirely in the browser.

The repository uses continuous security checks including [CodeQL](https://github.com/alexvirtech/wallet2qr/actions/workflows/codeql.yml), [Dependabot](https://github.com/alexvirtech/wallet2qr/security/dependabot) dependency monitoring, and [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/alexvirtech/wallet2qr). A formal third-party audit is planned after the core architecture is feature-stable.

See [SECURITY.md](SECURITY.md) for the full security policy, vulnerability reporting, and details on the non-custodial model. See [docs/security-checklist.md](docs/security-checklist.md) for the pre-audit checklist.

Key safeguards:
- Mnemonic and private keys live only in React state (never persisted or transmitted)
- Auto-lock after 5 minutes of inactivity
- Content-Security-Policy headers configured
- Password strength requirements enforced on encryption
