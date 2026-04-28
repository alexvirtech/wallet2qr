import { describe, it, expect } from "vitest";
import {
  encryptV3,
  decryptV3,
  generateBackupCode,
  computeProviderIdHash,
  base64urlEncode,
  base64urlDecode,
  ARGON2_TEST_PARAMS,
} from "../src/lib/compat/cryptoV3";
import {
  buildQrUrlV3,
  parseEnvelope,
  buildQrUrl,
  decryptPayload,
} from "../src/lib/compat/qrPayload";

const P = ARGON2_TEST_PARAMS;

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PASSWORD = "TestPass1!";
const GOOGLE_SUB = "116234567890123456789";
const GITHUB_ID = "12345678";
const MICROSOFT_OID = "00000000-0000-0000-c000-000000000046";
const TEST_BACKUP = "A1B2C3D4-E5F6A7B8-C9D0E1F2-A3B4C5D6";

describe("v3 utilities", () => {
  it("generateBackupCode produces 39-char hex with dashes", () => {
    const code = generateBackupCode();
    expect(code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
    expect(code.length).toBe(39);
  });

  it("computeProviderIdHash is deterministic", () => {
    const h1 = computeProviderIdHash(GOOGLE_SUB);
    const h2 = computeProviderIdHash(GOOGLE_SUB);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(22);
  });

  it("different IDs produce different hashes", () => {
    expect(computeProviderIdHash(GOOGLE_SUB)).not.toBe(
      computeProviderIdHash(GITHUB_ID)
    );
  });

  it("base64url round-trip", () => {
    const data = new Uint8Array([0, 1, 255, 128, 63, 64]);
    expect(base64urlDecode(base64urlEncode(data))).toEqual(data);
  });
});

describe("v3 mode a — password only", () => {
  it("encrypt then decrypt recovers plaintext", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "a" },
      P
    );
    expect(result.mode).toBe("a");
    expect(result.provider).toBeUndefined();

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "a" },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("wrong password fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "a" },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      "WrongPass1!",
      result.salt,
      { mode: "a" },
      P
    );
    expect(decrypted).toBeNull();
  });
});

describe("v3 mode b — password + Google stable ID", () => {
  it("encrypt then decrypt recovers plaintext", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "b", providerStableId: GOOGLE_SUB, provider: "google" },
      P
    );
    expect(result.mode).toBe("b");
    expect(result.provider).toBe("google");
    expect(result.providerIdHash).toBeDefined();

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "b", providerStableId: GOOGLE_SUB },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("wrong provider ID fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "b", providerStableId: GOOGLE_SUB, provider: "google" },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "b", providerStableId: "wrong-sub-id" },
      P
    );
    expect(decrypted).toBeNull();
  });

  it("wrong password fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "b", providerStableId: GOOGLE_SUB, provider: "google" },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      "WrongPass1!",
      result.salt,
      { mode: "b", providerStableId: GOOGLE_SUB },
      P
    );
    expect(decrypted).toBeNull();
  });
});

describe("v3 mode b — password + GitHub stable ID", () => {
  it("encrypt then decrypt recovers plaintext", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "b", providerStableId: GITHUB_ID, provider: "github" },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "b", providerStableId: GITHUB_ID },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });
});

describe("v3 mode b — password + Microsoft stable ID", () => {
  it("encrypt then decrypt recovers plaintext", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "b", providerStableId: MICROSOFT_OID, provider: "microsoft-entra-id" },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "b", providerStableId: MICROSOFT_OID },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });
});

describe("v3 mode c — password + backup code", () => {
  it("encrypt then decrypt recovers plaintext", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "c", backupCode: TEST_BACKUP },
      P
    );
    expect(result.mode).toBe("c");
    expect(result.backupCode).toBe(TEST_BACKUP);

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "c", backupCode: TEST_BACKUP },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("wrong backup code fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "c", backupCode: TEST_BACKUP },
      P
    );
    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      { mode: "c", backupCode: "WRONG-CODE-0000-0000-0000-0000-0000-0000" },
      P
    );
    expect(decrypted).toBeNull();
  });

  it("auto-generates backup code if not provided", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "c" },
      P
    );
    expect(result.backupCode).toBeDefined();
    expect(result.backupCode!.length).toBe(39);
  });
});

describe("v3 mode d — password + social + backup", () => {
  it("decrypt with social account (wrappedKey1)", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );
    expect(result.mode).toBe("d");
    expect(result.wrappedKey1).toBeDefined();
    expect(result.wrappedKey2).toBeDefined();

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      {
        mode: "d",
        providerStableId: GOOGLE_SUB,
        wrappedKey1B64: result.wrappedKey1,
        wrappedKey2B64: result.wrappedKey2,
      },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("decrypt with backup code (wrappedKey2) — social unavailable", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      {
        mode: "d",
        backupCode: TEST_BACKUP,
        wrappedKey1B64: result.wrappedKey1,
        wrappedKey2B64: result.wrappedKey2,
      },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("wrong password fails (social path)", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );

    const decrypted = await decryptV3(
      result.ciphertext,
      "WrongPass1!",
      result.salt,
      {
        mode: "d",
        providerStableId: GOOGLE_SUB,
        wrappedKey1B64: result.wrappedKey1,
        wrappedKey2B64: result.wrappedKey2,
      },
      P
    );
    expect(decrypted).toBeNull();
  });

  it("wrong provider ID fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );

    const decrypted = await decryptV3(
      result.ciphertext,
      TEST_PASSWORD,
      result.salt,
      {
        mode: "d",
        providerStableId: "wrong-sub-id",
        wrappedKey1B64: result.wrappedKey1,
        wrappedKey2B64: result.wrappedKey2,
      },
      P
    );
    expect(decrypted).toBeNull();
  });

  it("wrong backup code fails", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );

    const decrypted = await decryptV3(
      result.ciphertext,
      "WrongPass1!",
      result.salt,
      {
        mode: "d",
        backupCode: "WRONG-CODE-0000-0000-0000-0000-0000-0000",
        wrappedKey1B64: result.wrappedKey1,
        wrappedKey2B64: result.wrappedKey2,
      },
      P
    );
    expect(decrypted).toBeNull();
  });
});

describe("v3 QR URL round-trip", () => {
  it("mode a: buildQrUrlV3 → parseEnvelope → decryptV3", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "a" },
      P
    );
    const url = buildQrUrlV3(result);
    const env = parseEnvelope(url);
    expect(env.v).toBe(3);
    if (env.v !== 3) return;
    expect(env.m).toBe("a");

    const decrypted = await decryptV3(
      env.ds,
      TEST_PASSWORD,
      env.s,
      { mode: env.m },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("mode d: buildQrUrlV3 → parseEnvelope → decryptV3 (social)", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );
    const url = buildQrUrlV3(result);
    const env = parseEnvelope(url);
    expect(env.v).toBe(3);
    if (env.v !== 3) return;
    expect(env.m).toBe("d");
    expect(env.p).toBe("google");
    expect(env.w1).toBeDefined();
    expect(env.w2).toBeDefined();

    const decrypted = await decryptV3(
      env.ds,
      TEST_PASSWORD,
      env.s,
      {
        mode: "d",
        providerStableId: GOOGLE_SUB,
        wrappedKey1B64: env.w1,
        wrappedKey2B64: env.w2,
      },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });

  it("mode d: backup path via URL", async () => {
    const result = await encryptV3(
      TEST_MNEMONIC,
      TEST_PASSWORD,
      { mode: "d", providerStableId: GOOGLE_SUB, provider: "google", backupCode: TEST_BACKUP },
      P
    );
    const url = buildQrUrlV3(result);
    const env = parseEnvelope(url);
    if (env.v !== 3) return;

    const decrypted = await decryptV3(
      env.ds,
      TEST_PASSWORD,
      env.s,
      {
        mode: "d",
        backupCode: TEST_BACKUP,
        wrappedKey1B64: env.w1,
        wrappedKey2B64: env.w2,
      },
      P
    );
    expect(decrypted).toBe(TEST_MNEMONIC);
  });
});

describe("legacy compatibility", () => {
  it("v1 QR still decrypts", () => {
    const url = buildQrUrl(TEST_MNEMONIC, TEST_PASSWORD);
    const env = parseEnvelope(url);
    expect(env.v).toBe(1);
    const result = decryptPayload(env.ds, TEST_PASSWORD);
    expect(result).toBe(TEST_MNEMONIC);
  });

  it("v3 envelope does not interfere with v1 parsing", () => {
    const v1url = "https://www.wallet2qr.com/?ds=U2FsdGVkX19abc";
    const env = parseEnvelope(v1url);
    expect(env.v).toBe(1);
    expect(env.ds).toBe("U2FsdGVkX19abc");
  });
});
