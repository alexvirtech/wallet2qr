# wallet2qr

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

- Mnemonic and private keys live only in React state (never localStorage/sessionStorage/network)
- Auto-lock after 5 minutes of inactivity
- Content-Security-Policy headers configured
