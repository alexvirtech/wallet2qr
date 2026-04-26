# Security Checklist (Pre-Audit)

A practical checklist for reviewing Wallet2QR before a formal third-party audit.

## A. Non-Custodial Guarantees

- [ ] No mnemonic, private key, or password is sent to any server
- [ ] No analytics or telemetry captures sensitive wallet data
- [ ] No server logs contain wallet secrets
- [ ] Clipboard handling reviewed (copy-to-clipboard clears or is user-initiated only)
- [ ] localStorage / sessionStorage usage reviewed (no secrets persisted beyond session)
- [ ] IndexedDB usage reviewed (if applicable)
- [ ] React state containing secrets is cleared on lock / unmount
- [ ] Network tab audit: no outbound request contains mnemonic, key, or password

## B. QR Encryption Model

- [ ] Password-based encryption uses AES-256-CBC (CryptoJS OpenSSL format)
- [ ] Key derivation uses EvpKDF with deterministic salt derived from SHA-256(password + plaintext)
- [ ] Salt and IV handling documented and reviewed
- [ ] QR payload format documented (URL-encoded OpenSSL ciphertext in `?ds=` parameter)
- [ ] Backward compatibility with text2qr / text2qrApp verified
- [ ] Deterministic mnemonic generation for incorrect passwords reviewed (plausible deniability)
- [ ] Password strength requirements enforced on encryption side

## C. Browser Wallet Risks

- [ ] XSS prevention: no `dangerouslySetInnerHTML`, user input is escaped
- [ ] Content Security Policy configured and enforced (`script-src`, `connect-src`, `frame-src`)
- [ ] `unsafe-eval` usage justified (required by dependencies) or removed
- [ ] `unsafe-inline` usage for styles reviewed
- [ ] Third-party dependency review (npm audit, known vulnerabilities)
- [ ] No eval() or Function() constructors in application code
- [ ] Secure iframe/window handling (frame-src: none)
- [ ] Subresource integrity for external scripts (if any)
- [ ] HTTPS enforced for all external API connections

## D. Key Derivation and Chain Support

- [ ] BIP-39 mnemonic validation uses @scure/bip39 with English wordlist
- [ ] BIP-32/44 derivation paths are standard for each chain
- [ ] EVM: m/44'/60'/0'/0/0
- [ ] Bitcoin: m/84'/0'/0'/0/0 (native SegWit)
- [ ] Solana: m/44'/501'/0'/0'
- [ ] Private key handling reviewed (hex conversion, no unintended logging)
- [ ] Address derivation verified against reference implementations

## E. Release Readiness

- [ ] CodeQL analysis clean or findings justified
- [ ] Dependabot alerts reviewed and resolved
- [ ] `npm audit` returns no high/critical vulnerabilities
- [ ] Manual review of all cryptographic flows completed
- [ ] Manual review of all network requests completed
- [ ] Rate limiter in place for external API calls
- [ ] Error messages do not leak sensitive information
- [ ] External pre-audit review requested
- [ ] Formal third-party audit scheduled before major public launch
