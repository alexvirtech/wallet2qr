# Compatibility Notes — wallet2qr ↔ text2qrApp

All values below **must** remain identical across `text2qrApp`, `text2qr`, `text2qrD`, `text2qrM`, and `wallet2qr`. A mismatch in any row breaks cross-app QR decoding.

| Concern | text2qrApp value | Notes |
|---|---|---|
| Cipher | AES-256-CBC (CryptoJS) | `CryptoJS.AES.encrypt` defaults to CBC |
| KDF | EVP_KDF (CryptoJS.EvpKDF), keySize 12 (48 bytes) | First 32 bytes → key, last 16 bytes → IV |
| KDF iterations | 1 (EVP_KDF default) | Not configurable in CryptoJS EvpKDF |
| Salt length | 8 bytes | Deterministic: first 2 words of `SHA256(password + plaintext)` |
| Salt source | `CryptoJS.SHA256(password + text).words.slice(0, 2)` | NOT random — same input always yields same salt |
| IV / nonce length | 16 bytes (128-bit) | Derived from `EvpKDF(password, salt).words.slice(8, 12)` |
| Payload envelope | OpenSSL format: `"Salted__"` (8 bytes) + salt (8 bytes) + ciphertext | `CryptoJS.format.OpenSSL` formatter |
| Payload encoding | Base64 (OpenSSL format `.toString()` output) | Then URL-encoded via `encodeURIComponent()` |
| QR content | Full URL: `${host}/?ds=${encodeURIComponent(base64_ciphertext)}` | Host varies per app (`getHost()`) |
| QR library | `qrcode` v1.5.4 | npm package `qrcode` |
| QR version | Auto (library selects based on data length) | Not pinned |
| QR ECC level | Default (M) | Not explicitly set in `toCanvas()` options |
| QR encoding mode | Byte (auto-detected from URL string input) | Library auto-selects |
| QR margin | 0 | `{ margin: 0 }` in options |
| Max plaintext | 1000 characters | Enforced via `maxLength="1000"` on textarea |
| Decode library (file) | `jsqr` v1.4.0 | Extracts `ds=` param from decoded URL |
| Decode library (camera) | `qr-scanner` v1.4.2 | Same extraction logic |
| Decode URL strip | `data.replace(/^https?:\/\/[^\/]+\/\?ds=/, "")` | Strips any host, extracts ciphertext |
| Decrypt | `decodeURIComponent(text)` → `CryptoJS.AES.decrypt(decoded, password)` | Password-string mode (OpenSSL auto-parses salt) |
| Decrypt validation | Empty result → null; control chars `[\x00-\x08\x0E-\x1F]` → null | Returns null on failure |
| Decrypt fallback | On failure: `deterministicMnemonic(password, data)` | Generates BIP-39 phrase from `sha256(password + ciphertext)` |
| Input normalization | None — raw textarea `.value` | No NFKD, no trimming, no lowercasing |
| Word replacement | Optional: swap words at positions `pos1,pos2` (1-based) before encryption | **Removed in wallet2qr** (UI only — encrypted payload format unchanged) |

## Encryption Flow (verbatim from text2qrApp)

```javascript
const encrypt = (text, password) => {
    const hash = CryptoJS.SHA256(password + text)
    const salt = CryptoJS.lib.WordArray.create(hash.words.slice(0, 2), 8)
    const derived = CryptoJS.EvpKDF(password, salt, { keySize: 8 + 4 })
    const key = CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32)
    const iv = CryptoJS.lib.WordArray.create(derived.words.slice(8, 12), 16)
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(text), key, { iv })
    const result = CryptoJS.lib.CipherParams.create({
        ciphertext: encrypted.ciphertext,
        salt: salt,
        formatter: CryptoJS.format.OpenSSL,
    })
    return encodeURIComponent(result.toString())
}
```

## Decryption Flow (verbatim from text2qrApp)

```javascript
const decrypt = (text, password) => {
    const decodedText = decodeURIComponent(text)
    const decrypted = CryptoJS.AES.decrypt(decodedText, password)
    const result = decrypted.toString(CryptoJS.enc.Utf8)
    if (!result) return null
    if (/[\x00-\x08\x0E-\x1F]/.test(result)) return null
    return result
}
```

## QR URL Construction

```javascript
const ciphertext = `${getHost()}/?ds=${encrypt(text, password)}`
// QR encodes this full URL string
```

## QR URL Extraction on Decode

```javascript
const data = qrCode.data.replace(/^https?:\/\/[^/]+\/\?ds=/, "")
// Then: decrypt(data, password)
```
