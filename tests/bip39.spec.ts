import { describe, it, expect } from "vitest";
import { validateBip39Mnemonic, deriveEvmAccount } from "../src/lib/wallet/derive";

describe("BIP-39 validation", () => {
  it("validates a correct 12-word mnemonic", () => {
    const result = validateBip39Mnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    );
    expect(result.valid).toBe(true);
  });

  it("validates a correct 24-word mnemonic", () => {
    const result = validateBip39Mnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
    );
    expect(result.valid).toBe(true);
  });

  it("rejects wrong word count", () => {
    const result = validateBip39Mnemonic("abandon abandon abandon");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Expected");
  });

  it("rejects invalid words", () => {
    const result = validateBip39Mnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon xyz123"
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid words");
  });

  it("rejects bad checksum", () => {
    const result = validateBip39Mnemonic(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("checksum");
  });
});

describe("BIP-44 EVM derivation", () => {
  it("derives the correct address from a known mnemonic", () => {
    const account = deriveEvmAccount(
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    );
    // Well-known address for this mnemonic at m/44'/60'/0'/0/0
    expect(account.address.toLowerCase()).toBe(
      "0x9858EfFD232B4033E47d90003D41EC34EcaEda94".toLowerCase()
    );
  });

  it("returns a valid hex address", () => {
    const account = deriveEvmAccount(
      "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong"
    );
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(account.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
