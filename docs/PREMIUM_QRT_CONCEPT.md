# wallet2qr — Premium Account & QRT Token Concept

_Status: concept v0.1 — 2026-04-27_
_Owner: Alex (alex@vir-tec.net)_

## 1. Why this exists

Today wallet2qr seals a BIP-39 mnemonic into a QR with **password-only** encryption. The password is the single point of failure: anyone who scans the QR and guesses (or is told) the password recovers the wallet.

Premium adds a **third factor** — a server-side pepper bound to the user's Google or Apple account — so a leaked QR plus a leaked password is still not enough to decrypt. The attacker must additionally control the original Google/Apple identity.

Premium is monetized via **QRT**, a closed-loop, off-chain credit unit native to the wallet. QRT also becomes the meter for any future paid features (auto price refresh, advanced search, custom branding, etc.) without forcing a subscription model on a one-shot tool.

## 2. User tiers

| Tier    | Price                | Capabilities                                                                                            |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| Free    | $0                   | Encrypt / decrypt with password only. Manual price refresh. Single device.                              |
| Premium | 500 QRT (one-time)   | Free + **Google/Apple account pepper** as an optional second factor on both encrypt and decrypt flows.  |

Premium is a **one-time unlock**, not a subscription. The 500 QRT is debited from the user's QRT balance the first time they enable the G/A pepper option in the encrypt flow. Future paid features will be priced in QRT against the same balance.

## 3. The QRT token

QRT (QR-Token) is a **closed-loop, off-chain credit unit**. It is intentionally _not_ a blockchain asset — that keeps the product clear of MiCA / securities classification while still feeling native to a crypto-wallet UX.

- **Unit**: 100 QRT ≈ $1 (display ratio; actual fiat price comes from the bundle table)
- **Not transferable** between accounts
- **Not redeemable for fiat** (use-it-or-lose-it credit, like an in-app currency)
- **Refund window**: 14 days on **unspent** balance from the most recent purchase, per Stripe/PayPal policy

### Bundle ladder

| Bundle     | QRT     | Price   | Bonus | Effective rate |
| ---------- | ------- | ------- | ----- | -------------- |
| Trial      | 500     | $4.99   | —     | $1.00 / 100 QRT |
| Starter    | 1,000   | $9.99   | —     | $1.00 / 100 QRT |
| Standard   | 2,500   | $22.99  | +10%  | $0.92 / 100 QRT |
| Plus       | 5,000   | $39.99  | +25%  | $0.80 / 100 QRT |
| Vault      | 20,000  | $99.99  | +100% | $0.50 / 100 QRT |

Trial is a one-time offer per account. Minimum non-trial purchase is **1,000 QRT**.

### Two ledgers, one balance

Internally each account has two sub-balances that always sum to the displayed total:

- **Paid QRT** — purchased via Stripe / PayPal / on-chain. Refundable within window. Spent _last_.
- **Promo QRT** — granted as bonuses, referrals, or campaigns. Non-refundable. Spent _first_.

Spending promo first keeps refund accounting clean: a refund only ever reverses paid QRT, never promo.

## 4. Purchase flow

Users can top up from three rails:

1. **Stripe — fiat** (cards, Apple Pay, Google Pay, SEPA). Default rail.
2. **Stripe — crypto** (via Stripe's crypto onramp). USDC, ETH, BTC settled to fiat by Stripe.
3. **In-wallet on-chain** — pay directly from the connected wallet to a project-controlled address. Confirmed on-chain, then credited.

In all three rails, the **only** path that mutates the QRT balance is a verified provider webhook (`checkout.session.completed`, `payment_intent.succeeded`, on-chain confirmation watcher). The success page never grants tokens. This makes refunds, retries, double-clicks, and closed browser tabs safe by construction.

## 5. Architecture

### Source of truth: server-side append-only ledger

```
ledger_entries
  id              uuid
  account_id      uuid
  delta_qrt       int        -- positive = credit, negative = debit
  bucket          enum('paid','promo')
  reason          enum('purchase','refund','spend','bonus','adjustment')
  ref             text       -- stripe payment_intent id, on-chain tx hash, feature_id, ...
  created_at      timestamptz
```

Balance per bucket = `SUM(delta_qrt) WHERE account_id = ? AND bucket = ?`.

### Spending is transactional

```sql
BEGIN;
  SELECT balance_paid, balance_promo
    FROM accounts WHERE id = $1 FOR UPDATE;
  -- enforce: spend promo first, then paid
  -- enforce: total >= price
  INSERT INTO ledger_entries (...) VALUES (...);   -- one or two rows
  UPDATE accounts SET balance_paid=..., balance_promo=... WHERE id = $1;
COMMIT;
```

The `accounts.balance_*` columns are a **denormalized cache** of the ledger sum, refreshed inside the same transaction. The ledger is authoritative; if the cache ever drifts, it is rebuilt from the ledger.

### Client balance is a UX cache only

The browser shows a balance, but that number is never trusted by the server. Every spend hits the server, which re-reads the ledger inside `FOR UPDATE` and either succeeds or returns `INSUFFICIENT_FUNDS`. The client display is then refreshed from the server response.

### Webhooks are the only path that increases balance

```
Stripe / PayPal / on-chain watcher
        │
        ▼
   /api/billing/webhook   ← signature-verified, idempotent on (provider, event_id)
        │
        ▼
   ledger_entries (+delta, bucket='paid', ref=event_id)
```

The success / thank-you page reads the ledger; it does not write to it. If the webhook is delayed, the success page polls until the credit shows up (or surfaces a "still processing" state).

## 6. Premium feature: Google/Apple pepper (first paid feature)

This is the inaugural QRT-priced feature and the one the prototype (task A1) will implement.

- **What it is**: a 256-bit secret derived server-side from the user's verified `sub` claim plus a server-held master secret: `pepper = HKDF-SHA256(ikm=server_master_secret, salt="wallet2qr-pep-v1", info=provider+"|"+sub, L=32)`.
- **What it does**: mixed into the password before key derivation, so both password _and_ control of the original Google/Apple account are required to decrypt.
- **Where it lives**: never stored at rest on the client; never written to logs; only ever delivered over an authenticated HTTPS session to the account that owns the `sub`.
- **What's in the QR**: a versioned envelope that records _which_ provider was used and a hash of the `sub` (so the decrypt UI knows what login to ask for) — **never the pepper itself, never the raw `sub`**.

The exact envelope format and code-level integration are specified in `A1_PROMPT.md`.

## 7. Account page

A single `/account` page surfaces:

- **Identity**: connected wallet (always), Google / Apple link (optional, required for premium pepper)
- **QRT balance**: paid + promo, with the next bundle's break-even price hinted
- **Top up**: bundle picker → Stripe or on-chain
- **Premium status**: "Google pepper — enabled (500 QRT spent on 2026-04-27)"
- **Ledger**: paginated transaction history with filter by reason
- **Refund**: a single button on each refundable purchase row, within the window, when `unspent paid QRT >= purchase amount`

## 8. Out of scope for v0.1

Tracked here so they're not forgotten, but not built in the first cut:

- Auto price refresh every 20 s (Feature **A**, future QRT-priced)
- Non-zero account search (Feature **B**, scope TBD)
- Multi-device sync of premium state (currently per-account, propagates via login)
- Promo / referral engine (the `promo` bucket exists; the campaigns to fill it don't yet)

## 9. Open questions

1. Apple Sign-In's `sub` is **per-app-team**, not per-user-globally. Confirm this is acceptable (it is — it just means the pepper is tied to the Apple-issued identifier for our app).
2. Should the pepper be rotatable? Today: **no** — rotating it would brick every QR ever encrypted with the old pepper. Document this loudly in the encrypt flow.
3. On-chain top-up: which chain(s) for v0.1? Suggest starting with **USDC on Base** (low fees, easy receipt confirmation), expand later.
