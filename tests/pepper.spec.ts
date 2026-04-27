import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptV2,
  decryptV2,
} from "../src/lib/compat/crypto";
import {
  buildQrUrl,
  buildQrUrlV2,
  parseEnvelope,
  decryptPayload,
  decryptPayloadV2,
} from "../src/lib/compat/qrPayload";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PASSWORD = "testPass123!";
const TEST_PEPPER = "dGVzdHBlcHBlcmZvcnVuaXR0ZXN0czEyMzQ1Njc4"; // fixed base64 string

describe("v1 round-trip (no pepper) — unchanged", () => {
  it("encrypt then decrypt recovers the plaintext", () => {
    const payload = encrypt(TEST_MNEMONIC, TEST_PASSWORD);
    const result = decrypt(payload, TEST_PASSWORD);
    expect(result).toBe(TEST_MNEMONIC);
  });

  it("wrong password returns null", () => {
    const payload = encrypt(TEST_MNEMONIC, TEST_PASSWORD);
    expect(decrypt(payload, "wrong")).toBeNull();
  });
});

describe("v2 round-trip (with pepper)", () => {
  it("encryptV2/decryptV2 recovers the plaintext", () => {
    const payload = encryptV2(TEST_MNEMONIC, TEST_PASSWORD, TEST_PEPPER);
    const result = decryptV2(payload, TEST_PASSWORD, TEST_PEPPER);
    expect(result).toBe(TEST_MNEMONIC);
  });

  it("wrong password with correct pepper returns null", () => {
    const payload = encryptV2(TEST_MNEMONIC, TEST_PASSWORD, TEST_PEPPER);
    expect(decryptV2(payload, "wrong", TEST_PEPPER)).toBeNull();
  });

  it("correct password with wrong pepper returns null", () => {
    const payload = encryptV2(TEST_MNEMONIC, TEST_PASSWORD, TEST_PEPPER);
    expect(decryptV2(payload, TEST_PASSWORD, "wrongPepper")).toBeNull();
  });

  it("v2 ciphertext cannot be decrypted with v1 decrypt (password only)", () => {
    const payload = encryptV2(TEST_MNEMONIC, TEST_PASSWORD, TEST_PEPPER);
    expect(decrypt(payload, TEST_PASSWORD)).toBeNull();
  });
});

describe("envelope parsing", () => {
  it("v1 URL parses to { v: 1 }", () => {
    const url = "https://www.wallet2qr.com/?ds=U2FsdGVkX19abc";
    const env = parseEnvelope(url);
    expect(env.v).toBe(1);
    expect(env.ds).toBe("U2FsdGVkX19abc");
  });

  it("v2 URL parses to { v: 2, pep, sh, ds }", () => {
    const url =
      "https://www.wallet2qr.com/?ds=U2FsdGVkX19abc&v=2&pep=google&sh=abc123";
    const env = parseEnvelope(url);
    expect(env.v).toBe(2);
    expect(env.ds).toBe("U2FsdGVkX19abc");
    if (env.v === 2) {
      expect(env.pep).toBe("google");
      expect(env.sh).toBe("abc123");
    }
  });

  it("v1 buildQrUrl emits zero extra query params", () => {
    const url = buildQrUrl(TEST_MNEMONIC, TEST_PASSWORD);
    const u = new URL(url);
    const params = Array.from(u.searchParams.keys());
    expect(params).toEqual(["ds"]);
  });

  it("v2 buildQrUrlV2 emits exactly three extra query params", () => {
    const url = buildQrUrlV2(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      TEST_PEPPER,
      "google",
      "testhash123"
    );
    const u = new URL(url);
    const params = Array.from(u.searchParams.keys());
    expect(params).toContain("ds");
    expect(params).toContain("v");
    expect(params).toContain("pep");
    expect(params).toContain("sh");
    expect(params.length).toBe(4);
    expect(u.searchParams.get("v")).toBe("2");
    expect(u.searchParams.get("pep")).toBe("google");
    expect(u.searchParams.get("sh")).toBe("testhash123");
  });
});

describe("full v2 QR round-trip via URL", () => {
  it("buildQrUrlV2 → parseEnvelope → decryptPayloadV2 recovers plaintext", () => {
    const url = buildQrUrlV2(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      TEST_PEPPER,
      "google",
      "somehash"
    );
    const env = parseEnvelope(url);
    expect(env.v).toBe(2);
    const result = decryptPayloadV2(env.ds, TEST_PASSWORD, TEST_PEPPER);
    expect(result).toBe(TEST_MNEMONIC);
  });

  it("v1 QR still decrypts normally", () => {
    const url = buildQrUrl(TEST_MNEMONIC, TEST_PASSWORD);
    const env = parseEnvelope(url);
    expect(env.v).toBe(1);
    const result = decryptPayload(env.ds, TEST_PASSWORD);
    expect(result).toBe(TEST_MNEMONIC);
  });
});

describe("pepper derivation (server-side)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("derivePepper is deterministic for same (provider, sub)", async () => {
    const { derivePepper } = await import("../src/lib/pepper");
    const p1 = derivePepper("google", "123456");
    const p2 = derivePepper("google", "123456");
    expect(p1).toBe(p2);
  });

  it("different sub produces different pepper", async () => {
    const { derivePepper } = await import("../src/lib/pepper");
    const p1 = derivePepper("google", "123456");
    const p2 = derivePepper("google", "654321");
    expect(p1).not.toBe(p2);
  });

  it("different provider produces different pepper", async () => {
    const { derivePepper } = await import("../src/lib/pepper");
    const p1 = derivePepper("google", "123456");
    const p2 = derivePepper("apple", "123456");
    expect(p1).not.toBe(p2);
  });

  it("subHash is deterministic", async () => {
    const { subHash } = await import("../src/lib/pepper");
    const h1 = subHash("123456");
    const h2 = subHash("123456");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(22);
  });
});
