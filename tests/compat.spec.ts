import { describe, it, expect } from "vitest";
import CryptoJS from "crypto-js";

// Verbatim encrypt/decrypt from text2qrApp — used to generate fixtures
function encrypt(text: string, password: string): string {
  const hash = CryptoJS.SHA256(password + text);
  const salt = CryptoJS.lib.WordArray.create(hash.words.slice(0, 2), 8);
  const derived = CryptoJS.EvpKDF(password, salt, { keySize: 8 + 4 });
  const key = CryptoJS.lib.WordArray.create(derived.words.slice(0, 8), 32);
  const iv = CryptoJS.lib.WordArray.create(derived.words.slice(8, 12), 16);
  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.enc.Utf8.parse(text),
    key,
    { iv }
  );
  const result = CryptoJS.lib.CipherParams.create({
    ciphertext: encrypted.ciphertext,
    salt: salt,
    formatter: CryptoJS.format.OpenSSL,
  });
  return encodeURIComponent(result.toString());
}

function decrypt(text: string, password: string): string | null {
  try {
    const decodedText = decodeURIComponent(text);
    const decrypted = CryptoJS.AES.decrypt(decodedText, password);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) return null;
    if (/[\x00-\x08\x0E-\x1F]/.test(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// Import wallet2qr's implementation
import {
  encrypt as w2qEncrypt,
  decrypt as w2qDecrypt,
} from "../src/lib/compat/crypto";

// Test fixtures
const FIXTURES = [
  {
    name: '12-word mnemonic + passphrase "alpha"',
    mnemonic:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    password: "alpha",
  },
  {
    name: "24-word mnemonic + unicode passphrase",
    mnemonic:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",
    password: "p@$$wörd with spaces 🔐",
  },
  {
    name: "Empty passphrase",
    mnemonic:
      "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong",
    password: "",
  },
  {
    name: "Max-length 24-word mnemonic",
    mnemonic:
      "letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless",
    password: "testpass123!",
  },
];

describe("Crypto compatibility with text2qrApp", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.name, () => {
      it("wallet2qr encrypt matches text2qrApp encrypt", () => {
        const t2qPayload = encrypt(fixture.mnemonic, fixture.password);
        const w2qPayload = w2qEncrypt(fixture.mnemonic, fixture.password);
        expect(w2qPayload).toBe(t2qPayload);
      });

      it("wallet2qr decrypts text2qrApp payload", () => {
        const t2qPayload = encrypt(fixture.mnemonic, fixture.password);
        const decrypted = w2qDecrypt(t2qPayload, fixture.password);
        expect(decrypted).toBe(fixture.mnemonic);
      });

      it("text2qrApp decrypts wallet2qr payload", () => {
        const w2qPayload = w2qEncrypt(fixture.mnemonic, fixture.password);
        const decrypted = decrypt(w2qPayload, fixture.password);
        expect(decrypted).toBe(fixture.mnemonic);
      });

      it("round-trip: encrypt then decrypt preserves mnemonic", () => {
        const payload = w2qEncrypt(fixture.mnemonic, fixture.password);
        const result = w2qDecrypt(payload, fixture.password);
        expect(result).toBe(fixture.mnemonic);
      });
    });
  }

  it("wrong password returns null", () => {
    const payload = w2qEncrypt(FIXTURES[0].mnemonic, FIXTURES[0].password);
    expect(w2qDecrypt(payload, "wrong")).toBeNull();
  });
});
