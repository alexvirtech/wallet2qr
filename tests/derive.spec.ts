import { describe, it, expect } from "vitest";
import { deriveEvmAccount } from "../src/lib/wallet/derive";

describe("Wallet derivation from mnemonic", () => {
  const MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  it("derives consistent address across calls", () => {
    const a1 = deriveEvmAccount(MNEMONIC);
    const a2 = deriveEvmAccount(MNEMONIC);
    expect(a1.address).toBe(a2.address);
    expect(a1.privateKey).toBe(a2.privateKey);
  });

  it("different mnemonics produce different addresses", () => {
    const a1 = deriveEvmAccount(MNEMONIC);
    const a2 = deriveEvmAccount(
      "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"
    );
    expect(a1.address).not.toBe(a2.address);
  });

  it("handles extra whitespace", () => {
    const a1 = deriveEvmAccount(MNEMONIC);
    const a2 = deriveEvmAccount(`  ${MNEMONIC}  `);
    expect(a1.address).toBe(a2.address);
  });

  it("handles uppercase input", () => {
    const a1 = deriveEvmAccount(MNEMONIC);
    const a2 = deriveEvmAccount(MNEMONIC.toUpperCase());
    expect(a1.address).toBe(a2.address);
  });
});
