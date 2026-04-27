# Claude Code prompt — Task A1 prototype

_Paste everything below the "===PROMPT===" line into Claude Code, run from the repo root (`D:\Projects\enc_all\wallet2qr`)._

This implements the **Google/Apple account pepper** as an optional second factor in both encrypt and decrypt flows of wallet2qr. It is the prototype version: the premium gate is mocked (always-on for any logged-in account) so the cryptographic flow can be exercised end-to-end without the QRT ledger landing first.

The companion concept doc is `docs/PREMIUM_QRT_CONCEPT.md`. Read it before starting — the envelope format and the "webhooks-only credit" rule referenced there are load-bearing.

===PROMPT===

You are implementing **task A1** in the `wallet2qr` repo (Next.js 15 App Router, TypeScript, NextAuth v5, CryptoJS for the legacy AES envelope, `@noble/hashes` available). Read these files first before writing any code:

- `src/lib/compat/crypto.ts` — current `encrypt(text, password)` / `decrypt(text, password)` (CryptoJS OpenSSL envelope, byte-identical to the legacy `text2qrApp`)
- `src/lib/compat/qrPayload.ts` — `buildQrUrl` and `decryptPayload`
- `src/app/wallet-to-qr/page.tsx` — encrypt UI
- `src/app/qr-to-wallet/page.tsx` — decrypt UI
- `src/lib/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts` — existing NextAuth setup (Google provider already wired, currently gated to a single admin email — you will widen it)
- `docs/PREMIUM_QRT_CONCEPT.md` — concept context, especially §6

## Goal

Add an **optional second factor** to both flows: a server-side pepper derived from the user's verified Google or Apple account identity, mixed into key derivation so that even a leaked QR + leaked password cannot decrypt without control of the original account.

The prototype must be:

1. **Fully backward compatible.** Every existing v1 QR (no pepper) must still decrypt with password only. No data migration.
2. **Opt-in per QR.** A checkbox in the encrypt UI ("Bind to my Google/Apple account") flips the QR from v1 to v2. A matching checkbox in the decrypt UI ("This QR is bound to a Google/Apple account") triggers the login-then-decrypt path.
3. **Premium-gated, but mockable.** A single helper `isPremium(session)` decides whether the checkbox is enabled; the prototype implementation returns `true` for any logged-in user. A `TODO(QRT)` comment marks where the QRT ledger check will plug in.
4. **Provider-agnostic.** The envelope records whether the QR is bound to Google or Apple. Implement Google end-to-end; stub Apple at the provider config level (commented placeholder in `src/lib/auth.ts`) so the envelope and UI already speak both names.

## Cryptographic design

### Pepper derivation (server-side, never leaves the server's response)

```
pepper_bytes = HKDF-SHA256(
    ikm  = process.env.WALLET2QR_PEPPER_MASTER,   // 32 random bytes, base64
    salt = "wallet2qr-pep-v1",
    info = provider + "|" + sub,                  // e.g. "google|11223344..."
    L    = 32,
)
pepper_b64 = base64(pepper_bytes)                  // returned to client
```

- Read `WALLET2QR_PEPPER_MASTER` from env. Add it to `.env.example` with a generation hint (`openssl rand -base64 32`). Fail loudly at module load if missing in production; in dev, fall back to a constant test value and log a single warning so tests are reproducible.
- Use `@noble/hashes/hkdf` (already in the dependency tree via `@noble/hashes`). Do **not** invent a KDF.
- Pepper is **deterministic** per `(provider, sub)` — encrypt and decrypt of the same QR by the same account must produce the same pepper. Document this loudly: rotating the master secret bricks every v2 QR.

### Combined password used for AES key derivation

```
combined_secret = password + ":" + pepper_b64        // for v2 QRs
                = password                            // for v1 QRs (unchanged)
```

The existing CryptoJS path in `src/lib/compat/crypto.ts` is then fed `combined_secret` instead of `password`. The salt-derivation, EvpKDF, and AES-CBC steps stay byte-identical, because we **must not** change v1 behaviour and we want the v2 path to reuse the same primitive.

### QR envelope

v1 (existing, unchanged):
```
https://www.wallet2qr.com/?ds=<urlencoded-openssl-ciphertext>
```

v2 (new):
```
https://www.wallet2qr.com/?ds=<urlencoded-openssl-ciphertext>&v=2&pep=google&sh=<sub-hash>
```

- `v=2` — envelope version. Decrypt code branches on this.
- `pep=google` | `pep=apple` — which provider's pepper was used at encrypt time.
- `sh` — base64url(sha256(sub)) of the account that encrypted. Truncate to 16 bytes (22 chars) for QR density. Used **only** so the decrypt UI can detect "wrong account logged in" before sending the password to the wrong derivation path. It is **not** a security claim — collisions are non-issues at this length for a UX hint, and the hash hides the raw `sub` from anyone who scans the QR.

`buildQrUrl` and the URL-parsing helper `extractPayloadFromQrData` must be updated to read/write all three new parameters. Add unit tests that round-trip both v1 and v2 envelopes.

## API surface (new)

Add a single authenticated endpoint:

```
POST /api/pepper
  request:  {}    // session cookie identifies the user
  response: { provider: "google" | "apple", sub_hash: string, pepper: string }
  errors:
    401  not signed in
    402  signed in but not premium  (prototype: never returns this; real impl will)
    500  WALLET2QR_PEPPER_MASTER misconfigured
```

The handler:
1. Calls `auth()` from `src/lib/auth.ts`. Reject with 401 if no session.
2. Reads `provider` and `sub` from the session. **You will need to extend the JWT/session callbacks in `src/lib/auth.ts` to surface `account.provider` and `account.providerAccountId` (the `sub`) on the session object** — they are not exposed by default. Type the session augmentation in `src/lib/auth.d.ts` (create it).
3. Calls `isPremium(session)` — for the prototype, returns `true` if signed in.
4. Derives the pepper as above and returns it.
5. **Never log the pepper.** Add an explicit eslint comment if needed.

## NextAuth changes

- Remove the single-email allow-list in `signIn` for non-admin paths. Keep the admin gate for `/admin/*` only — move that check into `src/middleware.ts` instead of the global `signIn` callback. The encrypt/decrypt pages must accept any signed-in Google account.
- Add Apple as a commented provider block with a `TODO(A1-apple)` marker; do not wire credentials.
- Augment session/JWT callbacks to expose `provider` and `sub` (see API step 2).

## UI changes

### Encrypt page (`src/app/wallet-to-qr/page.tsx`)

- Add a checkbox under the password fields: **"Bind this QR to my Google/Apple account (premium)"**.
- When checked:
  - If not signed in: render an inline "Sign in with Google" button (use `signIn("google")` from `next-auth/react`). Disable the Encrypt submit until signed in.
  - If signed in but not premium: show "Premium required — TODO(QRT) hook" and disable submit. (For the prototype, signed-in == premium, so this branch is unreachable but must exist.)
  - If signed in and premium: on submit, POST `/api/pepper`, get back `{provider, sub_hash, pepper}`, build the v2 QR with `combined_secret = password + ":" + pepper` and the envelope params above.
- When unchecked: existing v1 path, no behaviour change.

### Decrypt page (`src/app/qr-to-wallet/page.tsx`)

- After QR decode, **inspect the envelope** before showing the password field:
  - v1 → existing flow, unchanged.
  - v2 → show a banner: "This QR is bound to a {Google|Apple} account. Sign in to decrypt." and a Sign-In button. The password field is shown but submit is disabled until signed in.
  - v2 + signed in but `sha256(session.sub) !== sh` → show error "This QR was bound to a different account. Sign out and use the original account." Block submit.
  - v2 + signed in + matching `sh` → on Decrypt, POST `/api/pepper`, fetch the pepper, attempt decrypt with `combined_secret`. On failure, fall back to the deterministic-mnemonic path **only for v1** — for v2, treat decrypt failure as "wrong password or wrong account" and surface that.

The optional checkbox the user described ("If the user choose this option in decrypt flow — it's optional — checkbox") is interpreted as: the v2 path is auto-detected from the envelope, but the user can _force_ a v2 attempt on a QR that has no `v=2` marker (e.g. they exported it pre-update and we want to support manual override). Add the checkbox and label it **"Force account-bound decrypt (advanced)"**, default off, only visible when no `v=2` is detected. Most users will never touch it.

## Tests

Add `tests/pepper.spec.ts` covering:

1. v1 round-trip (no pepper) byte-identical to current `compat.spec.ts` expectation.
2. v2 round-trip with a fixed `(provider, sub, master_secret)` triplet — assert decrypt recovers the plaintext.
3. v2 with wrong password → null.
4. v2 with right password but wrong `sub` (i.e. different pepper) → null.
5. Envelope parsing: v1 URL parses to `{v:1}`; v2 URL parses to `{v:2, pep, sh, ds}`.
6. URL builder emits exactly three extra query params for v2 and zero for v1.

Mock the `/api/pepper` HTTP call by stubbing the `fetchPepper()` helper you'll factor out — do not run a Next dev server in tests.

## Constraints / things not to do

- Do **not** change `encrypt()` / `decrypt()` in `src/lib/compat/crypto.ts`. Add a new `encryptV2(text, password, pepper)` / `decryptV2(ct, password, pepper)` that internally call the existing functions with `combined_secret`. This preserves the byte-for-byte `text2qrApp` compatibility guarantee.
- Do **not** put the pepper in localStorage, sessionStorage, IndexedDB, cookies, or any client-persistent surface. It lives in a closure for the duration of the encrypt/decrypt operation and is dropped.
- Do **not** include the raw `sub` in the QR envelope. Only the truncated hash.
- Do **not** add a billing/QRT module in this PR. Leave `TODO(QRT)` markers at: (a) the `isPremium()` body, (b) the 402 branch in `/api/pepper`, (c) the "Premium required" UI branch in the encrypt page.
- Do **not** widen the admin email allow-list silently — move it to middleware as described, with a comment explaining why.

## Deliverables

- Updated files listed above + new files (`src/app/api/pepper/route.ts`, `src/lib/pepper.ts`, `src/lib/auth.d.ts`, `tests/pepper.spec.ts`).
- `pnpm test` (or `npm test` / `vitest run`) green, including the new spec.
- A short note appended to `COMPAT_NOTES.md` describing the v1↔v2 envelope distinction and the pepper rotation hazard.
- Update `.env.example` with `WALLET2QR_PEPPER_MASTER=` and a one-line generation hint.

When you finish, summarize: (1) what envelope params were added, (2) which files changed, (3) how to manually exercise the v2 round-trip in the dev server, and (4) any deviations from this spec with reasons.

===END PROMPT===
