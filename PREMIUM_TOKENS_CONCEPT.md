# Wallet2QR Premium — Token Model Concept

> Status: **Draft proposal v0.1** · Owner: Alex · Date: 2026-04-26
> Scope: Monetization design for a premium tier of wallet2qr powered by an in-app token currency.

---

## 1. Executive summary

We introduce a **prepaid in-app credit** called **QRT** (working name: *Wallet2QR Tokens*). Users buy QRT in bundles via Stripe, PayPal, or crypto on-ramp. QRT is a **closed-loop, off-chain accounting unit** — it is **not** a blockchain token, not transferable between users, and not tradeable. This avoids securities, MiCA, and exchange-license concerns while still giving us a flexible meter.

Tokens are spent on three contracted features (live price stream, non-zero account discovery, physical engraved card) plus a roadmap of high-margin add-ons (see §7).

The model is deliberately a **credit/meter** rather than a subscription because:

- The headline features are bursty and asymmetric (one-time card order vs. occasional balance scan vs. continuous price stream).
- Users who only want a card don't need a recurring bill.
- A token wallet feels native to a crypto-wallet UX.
- We can later layer a "Pro subscription" on top that includes a monthly QRT allowance.

---

## 2. Token economics

### 2.1 Unit and pricing reference

| Property | Value |
|---|---|
| Internal unit | **1 QRT** |
| Reference value | **1 QRT ≈ $0.01 USD** (i.e. 100 QRT = $1) |
| Display | "1,250 QRT" or "$12.50 in tokens" — toggle in settings |
| Decimal precision | Integer only (no fractional QRT) |
| Refund window | 14 days, **only on unused balance**, processed by support |
| Expiry | None for purchased tokens. Promo / bonus tokens expire after 12 months of inactivity. |

A 100:1 ratio keeps small consumptions (e.g. 1 minute of price streaming) representable as small integers (e.g. 5 QRT/min) without fractions, while the bigger SKUs (a metal card) still fit in a normal-looking integer (e.g. 8,900 QRT).

### 2.2 Bundle ladder

Volume discount drives larger top-ups and reduces payment-processor fees per QRT issued.

| Bundle | QRT | Price (USD) | Bonus | Effective rate |
|---|---|---|---|---|
| Trial | 500 | $4.99 | — | $0.0100/QRT |
| Starter | 1,200 | $9.99 | +20% | $0.0083/QRT |
| Plus | 3,000 | $19.99 | +50% | $0.0067/QRT |
| Pro | 8,000 | $49.99 | +60% | $0.0062/QRT |
| Vault | 20,000 | $99.99 | +100% | $0.0050/QRT |

A separate **physical card SKU** is sold as a fixed-price purchase that includes the QRT cost of the card service plus shipping, so users never have to "stack" bundles to afford a card.

### 2.3 Consumption catalog (initial)

Prices are tunable via server-side config; values below are starting points, calibrated against direct cost + a target gross margin of ~70% on the digital features.

| Feature | Burn |
|---|---|
| **A. Live price stream** (20 s refresh, all configured assets) | **5 QRT / minute** (300 QRT/h, ~$3/h). Free users keep today's 60 s cache. |
| **A. Live price stream — daily cap** | Auto-cap at 200 QRT/day (≈40 min of active use) unless user disables the cap |
| **B. Non-zero account scan** | **150 QRT / scan** per BIP-44 path family per network, up to N standard derivation paths. Bulk discount: 5 networks for 600 QRT. |
| **B. Deep scan** (extended derivation depth, e.g. 50 indexes × 5 schemes) | **500 QRT / wallet** |
| **C. Plastic card with engraved QR** | **4,500 QRT** + actual shipping (charged in fiat at checkout) |
| **C. Stainless-steel card** | **8,900 QRT** + shipping |
| **C. Titanium card (premium)** | **15,000 QRT** + shipping |
| **C. Reorder / spare** | Same SKU price, no setup discount |

### 2.4 Free tier preserved

Everything that exists today stays free. The 1,000-char encryption ceiling, manual mnemonic→QR, manual QR→wallet, single-shot price lookup, send/receive/exchange — none of these are paywalled. Premium *adds* capabilities, never removes existing ones. This is critical for trust in a wallet tool.

---

## 3. Token data model

### 3.1 Server-side ledger (source of truth)

Tokens **must** live in a server-side ledger. A client-side balance is a UX cache only. Reasoning: the app holds keys client-side and we want to keep that property, but a user must not be able to mint tokens by editing localStorage.

```
accounts
  user_id              uuid
  email                string
  created_at           timestamp
  refundable_balance   integer   -- bought tokens (refundable in window)
  promo_balance        integer   -- granted/bonus, non-refundable
  total_purchased      integer   -- lifetime (for tier perks)

token_transactions   -- append-only ledger
  id                   uuid
  user_id              uuid
  kind                 enum('purchase', 'consume', 'refund', 'grant', 'expire', 'adjust')
  delta                integer   -- signed
  bucket               enum('refundable', 'promo')
  feature_code         string?   -- e.g. 'price_stream', 'scan_nonzero', 'card_metal'
  reference_id         string?   -- payment id, scan id, order id
  created_at           timestamp
  meta_json            jsonb     -- audit blob
```

Balance is always `SUM(delta) GROUP BY bucket` — never stored as a denormalized field that can drift. The `accounts.*_balance` columns are materialized projections updated transactionally.

Spending order: **promo first**, then refundable. This keeps the refund math simple.

### 3.2 Client model

The web client gets a signed JWT containing `user_id`, `balance_snapshot`, and `snapshot_at`. The header shows the snapshot; every consumption call hits the server, which returns the new authoritative balance and the client updates. If the server says "insufficient balance," the UI shows a top-up modal.

Atomicity for consumption uses a single SQL transaction:

```sql
BEGIN;
  SELECT balance FROM accounts WHERE user_id = $1 FOR UPDATE;
  -- check balance >= cost
  INSERT INTO token_transactions(...);
  UPDATE accounts SET ... WHERE user_id = $1;
COMMIT;
```

For the price stream we use a **leased meter**: the client buys a 5-minute lease for 25 QRT and the server enforces it. This avoids per-second writes and keeps the streaming UX snappy if the network blips.

### 3.3 Anti-abuse

- Rate limits per user and per IP on consumption endpoints.
- Stripe/PayPal **webhook is the only path that increases `refundable_balance`**. The checkout success page never grants tokens directly.
- Idempotency keys on every consumption call (so a retried request doesn't double-charge).
- Manual review queue for any account that hits >3 chargebacks or >50 scans/day.

---

## 4. Payment integration

### 4.1 Provider choice

| Provider | Role | Why |
|---|---|---|
| **Stripe Checkout** | Default | Apple Pay, Google Pay, cards, SEPA, regional methods; lowest friction; mature webhooks |
| **PayPal** | Alternate | Required by users who don't want to give cards; high trust outside EU/US |
| **Coinbase Commerce** *(optional, phase 2)* | Crypto top-up | Native fit for a crypto wallet audience; users can pay in BTC/ETH/USDC and avoid KYC re-entry |

All three follow the same fulfillment shape: hosted checkout → webhook → ledger insert.

### 4.2 Purchase flow (Stripe example)

1. Client `POST /api/billing/checkout` with `{bundle: "plus"}`.
2. Server creates a `Stripe Checkout Session` with `metadata.user_id` and `metadata.bundle`.
3. Returns the session URL; client redirects.
4. Stripe redirects back to `/billing/success?session_id=...`. The success page **does not** grant tokens — it just polls a `GET /api/billing/status?session_id=...` endpoint until `status=fulfilled`.
5. **In parallel**, Stripe sends `checkout.session.completed` to `POST /api/webhooks/stripe`. The webhook verifies signature, looks up bundle, inserts a `purchase` transaction in the ledger. Idempotent on `session_id`.
6. Once the ledger insert lands, the `/api/billing/status` endpoint returns `fulfilled` and the success page reveals the new balance.

This is the same shape the Anthropic API itself uses for billing top-ups, and the same pattern Stripe documents for Checkout. Crucially, **token issuance is decoupled from page navigation** — closing the browser doesn't lose the purchase.

### 4.3 Refunds

A user clicks "Request refund" within 14 days. We compute `min(refundable_balance, original_purchase_amount)`. If positive, we issue a Stripe refund pro-rated to the unused portion and burn that many QRT in the ledger. Outside the window, support-only and discretionary.

### 4.4 Tax / VAT / localization

- Stripe Tax handles VAT/GST registration and invoicing.
- PayPal: rely on jurisdiction defaults; accept that EU pricing shows VAT inclusive.
- Display price in local currency where Stripe supports it; charge in USD by default.

---

## 5. UX surfaces

### 5.1 Balance pill in `Nav.tsx`

A persistent token-balance pill in the header — `1,250 QRT ▾`. Click opens a dropdown with:

- "Top up tokens"
- "Transaction history"
- "Manage subscription" (if applicable)
- "Refund / support"

When balance drops below a user-configurable threshold (default 200 QRT), the pill turns amber. Below 0 attempts → red + auto-suggest top-up.

### 5.2 Pre-spend confirmation

For features costing >100 QRT, show a confirm modal: *"This scan will use 600 QRT. Your balance will be 2,400 QRT. [Confirm] [Cancel]"*. For continuous meters (price stream), show a live counter and a one-click stop.

### 5.3 Account & history page

`/account/billing` — purchases, consumption, balances per bucket, downloadable invoices.

### 5.4 Empty-state nudges

If a user opens the wallet page with $0 spent, show a non-intrusive banner: *"Watching prices update live? Premium streams every 20 s — try 5 minutes free."* (One-time 25 QRT promo grant.) Avoid dark patterns: never auto-start a paid stream; always require explicit opt-in.

### 5.5 Auto top-up (optional)

Settings: *"Auto-buy 1,200 QRT when balance drops below 200 QRT."* Stored as a Stripe customer + saved payment method. Strictly opt-in, with a clear monthly cap.

---

## 6. Mapping to your three contracted features

### 6.1 (A) Live price update every 20 s

Today `prices.ts` has `CACHE_TTL = 60_000` and a single CoinGecko `/simple/price` call. For the premium stream we either:

1. **Server-side fan-out**: a single backend worker holds an upstream connection (CoinGecko Pro plan or a paid feed like CoinAPI / CryptoCompare), pushes via WebSocket / SSE to subscribed clients. This caps our upstream bill regardless of user count and gives us the only viable path to *true* 20 s updates without rate-limit pain.
2. **Client polling at 20 s** with a token-gated proxy that uses our paid CoinGecko key.

Recommend (1). It justifies the burn rate (we have a real per-minute cost), and lets us upsell **<5 s** sub-streams later for traders.

The free-tier 60 s cache stays as the fallback when the lease expires.

### 6.2 (B) Search for non-zero accounts

This is the most defensible premium feature for a wallet-restoration audience: someone with an old mnemonic genuinely doesn't know which derivation scheme/account index has funds. The cost on our side is RPC calls plus indexer queries. Token pricing protects us from someone scanning thousands of indexes for fun.

Suggested productization (you said it'll be detailed later, so this is a sketch):

- **Standard scan**: first 20 indexes × all standard schemes (44'/49'/84' for BTC, 60' for ETH, etc.) on user-selected networks — flat 150 QRT/network.
- **Deep scan**: first 200 indexes — 500 QRT/wallet.
- **Custom scan**: user picks paths and networks — priced by endpoint count.
- Result page lists every (path, address, balance USD) row with non-zero balances and a one-click "open in wallet" that loads the path into the existing send/receive UI.

### 6.3 (C) Engraved physical card

This is a fulfillment business, not a SaaS feature — treat it as such:

- **Manufacturing**: outsource. Established vendors ship laser-engraved metal NFC/QR cards (Gripp, Steel Wallet, Cryptotag, etc.) with white-label SKUs. Don't bring engraving in-house.
- **Pricing**: cost-plus. Worked example: titanium plate + laser etching costs ~$25–35 from a contract supplier; we sell at $89 (≈ 8,900 QRT + shipping). Margin covers customer support and replacements.
- **Fulfillment**: dedicated checkout page, not a token spend. User confirms the encrypted QR payload, picks card material, confirms shipping address, pays mixed fiat + tokens (or pure fiat). The QR payload **never leaves the client unencrypted** — we ship the already-encrypted QR string to the engraver.
- **Privacy**: shipping address is collected only for the order and purged 90 days after delivery. Document this in the privacy policy — it's a real differentiator.
- **Tamper evidence**: include a numbered tamper seal in the package; photograph it pre-ship; let the customer scan it on arrival.

---

## 7. Additional features to drive token spend

These are ranked by my estimate of (motivation × ease of build).

| # | Feature | Burn idea | Why it sells |
|---|---|---|---|
| 1 | **Encrypted cloud backup vault** — encrypted-at-rest copy of the QR payload stored on our server, retrievable with master password | 50 QRT/month per vault | Solves "I lost the paper." Recurring burn. Strong retention. |
| 2 | **Inheritance / dead-man's-switch** — a sealed second QR is released to a designated email if the user doesn't check in for N months | 1,000 QRT/year per recipient | Cold-storage users skew toward "estate planning" thinking. Premium feel. |
| 3 | **Multi-wallet portfolio dashboard** — aggregate USD value across all imported mnemonics with the live price stream | 100 QRT/wallet/month | Stacks naturally with feature A. |
| 4 | **Watchlist alerts** — email/push when a watched address sees inbound activity, or when an asset crosses a price threshold | 20 QRT/alert/month | Low burn, sticky habit. |
| 5 | **Branded / custom QR styling** — logo, colors, ECC level, frame; export at print resolution | 200 QRT/export | Vanity-driven; near-zero marginal cost. |
| 6 | **Multi-page printable backup booklet** — split a long mnemonic across N indexed QR pages with checksum and recovery instructions | 500 QRT/booklet | Clear premium artifact, printable PDF. |
| 7 | **PDF wallet inventory report** for tax/audit — addresses, current balances, historic values | 300 QRT/report | Annual demand spike around tax season. |
| 8 | **Address book with private notes** — encrypted server-side; sync across devices | 100 QRT/month | Removes friction the free tier has today. |
| 9 | **Reduced swap fees** — token holders pay 25–50% less of the existing Thorchain/LiFi convenience fee | Implicit (you keep the rest) | Aligns with the swap module already in `ThorSwapForm.tsx` / `ExchangeForm.tsx`. |
| 10 | **Hardware-wallet sync (Ledger/Trezor)** — view balances + sign by routing the same encrypted-QR flow through HW signers | 1,500 QRT one-time unlock | Pulls in a more affluent user segment. |
| 11 | **API access** — same endpoints we use internally, exposed for power users to integrate with their own tooling | 0.1 QRT/call, monthly cap | Long-tail recurring revenue from a small but loyal cohort. |
| 12 | **NFT view across chains** — indexer-backed; expensive to run, easy to upsell | 50 QRT/wallet refresh | Lights up the wallet UI visually. |
| 13 | **"Estate kit" physical bundle** — three engraved cards (you, attorney, safe deposit), tamper seals, instructions, sealed envelope | Fixed SKU ~$249 | Highest-ARPU one-time purchase. |
| 14 | **Custom-domain QR** — user-owned domain in the QR URL instead of `wallet2qr.app`, so cards survive a brand rename | 5,000 QRT setup + 1,000 QRT/year | Power-user / agency feature. |
| 15 | **Whitelabel for businesses** — a CPA or estate-planning firm issues encrypted QR backups under their own brand to their clients | Contract-priced | Largest possible TAM expansion; later phase. |

These are intentionally diverse — a small recurring meter (alerts), several mid-tier digital SKUs (booklet, vanity QR), a couple of high-ARPU physical/professional plays (estate kit, whitelabel), and the API tail. The point is to give every persona a reason to keep tokens loaded.

---

## 8. Build sequencing

A pragmatic order that surfaces revenue quickly and keeps risk bounded:

1. **M1 — Identity + ledger + Stripe/PayPal top-up.** No spending features yet. Ships the balance pill, the bundles page, the receipts page, webhook fulfillment, refunds. This alone is 3–4 weeks of focused work.
2. **M2 — Live price stream (feature A).** Smallest scope of the three contracted features and the cleanest test of the metering plumbing.
3. **M3 — Non-zero account scan (feature B).** Spec the scan UI; pick an indexer per chain (Blockstream/Mempool for BTC, Etherscan/Alchemy for EVM, Helius for Solana, etc.).
4. **M4 — Physical card (feature C).** Pick supplier, contract fulfillment, ship a beta of a single material (likely steel) before adding plastic/titanium.
5. **M5 — High-impact additions.** Pick 2 of {cloud vault, inheritance switch, watchlist alerts, swap-fee discount} based on early M1–M4 telemetry.

A blocker worth surfacing now: **introducing accounts** changes the trust story. Today wallet2qr is "client-side only, we see nothing." Premium needs an email and a server. Communicate this clearly: keys never leave the client, accounts only authenticate the QRT wallet, mnemonics are still encrypted client-side before any cloud-vault feature touches them.

---

## 9. Open questions

- Do we want a **subscription overlay** (e.g. "Pro $9/mo includes 1,500 QRT + all alerts free") on top of the bundle ladder, or stay strictly prepaid?
- Do we accept **crypto on-ramp** at launch, or treat it as M2+? (My lean: launch fiat-only, add crypto once the ledger is battle-tested.)
- Single global pricing, or **regional pricing**? Stripe makes this trivial; PayPal less so.
- Do we expose the **referral mechanic** (give 200 QRT, get 200 QRT) at launch or after we measure organic conversion first?
- For feature B, what's the **acceptable derivation breadth** before scans get expensive enough that we need to flat-rate them? Need a real estimate of indexer call cost per chain before we lock pricing.
- Card supplier — vet 2–3 vendors, request samples, evaluate engraving quality on a real encrypted QR string at maximum payload length.

---

*End of draft. Next step suggested: pick the bundle pricing and confirm M1 scope so we can break it into engineering tickets.*
