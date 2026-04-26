# Security

## Project Status

Wallet2QR is under active development. The project follows a **non-custodial architecture**: your mnemonic phrase, password, and private keys remain entirely under your control. The application must never store or transmit user mnemonic phrases, passwords, private keys, or decrypted wallet data to any server.

## Security Model

- **Non-custodial**: All cryptographic operations (encryption, decryption, key derivation) run exclusively in the browser. No secrets leave the client.
- **Session-only state**: The mnemonic is held in React state during a session and cleared on lock or tab close. It is never written to localStorage, sessionStorage, or transmitted over the network.
- **Auto-lock**: The wallet locks automatically after 5 minutes of inactivity and wipes all sensitive state from memory.
- **Content Security Policy**: HTTP headers restrict script sources, connection targets, and frame embedding.

## Continuous Security Scanning

The repository uses the following automated checks for security transparency:

| Check | Description |
|---|---|
| **GitHub CodeQL** | Static analysis for JavaScript/TypeScript vulnerabilities. Runs on every push to `main`, on pull requests, and weekly. |
| **Dependabot** | Monitors npm dependencies for known vulnerabilities. Opens pull requests for security updates automatically. |
| **OpenSSF Scorecard** | Supply-chain security assessment. Runs weekly and publishes results. |
| **Secret scanning** | GitHub secret scanning is recommended to be enabled in repository settings. |
| **Manual review** | All changes to cryptographic flows and wallet logic are reviewed before release. |

## Audit Status

A formal third-party security audit is planned after the core wallet architecture is feature-stable. Until then, the project relies on continuous automated scanning and manual review.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Email**: alex@extrasafe.chat
- **Do not** open a public GitHub issue for security vulnerabilities.
- We aim to acknowledge reports within 48 hours and provide a resolution timeline within 7 days.

## Scope

The following are in scope for security reports:

- Mnemonic, password, or private key exposure (network, storage, logs)
- QR encryption/decryption flaws
- Cross-site scripting (XSS) or injection vulnerabilities
- Content Security Policy bypasses
- Dependency vulnerabilities with a viable attack path

Out of scope:

- Denial-of-service attacks against the hosted site
- Issues in third-party dependencies without a demonstrated exploit
- Social engineering attacks
