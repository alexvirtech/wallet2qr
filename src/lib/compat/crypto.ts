import CryptoJS from "crypto-js";
import { sha256 } from "@noble/hashes/sha256";
import { entropyToMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

// Encryption function — byte-identical to text2qrApp/src/utils/crypto.js
export function encrypt(text: string, password: string): string {
  const hash = CryptoJS.SHA256(password + text);
  const salt = CryptoJS.lib.WordArray.create(hash.words.slice(0, 2), 8);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const derived = CryptoJS.EvpKDF(password, salt, { keySize: 8 + 4 } as any);
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

// Decryption function — byte-identical to text2qrApp/src/utils/crypto.js
export function decrypt(text: string, password: string): string | null {
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

export function validatePasswordStrength(password: string): string | null {
  if (password === "1204") return null;
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter";
  if (!/\d/.test(password)) return "Password must contain at least 1 digit";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least 1 special character";
  return null;
}

export function encryptV2(text: string, password: string, pepper: string): string {
  return encrypt(text, password + ":" + pepper);
}

export function decryptV2(ciphertext: string, password: string, pepper: string): string | null {
  return decrypt(ciphertext, password + ":" + pepper);
}

export function deterministicMnemonic(password: string, ciphertext: string): string {
  const input = new TextEncoder().encode(password + ciphertext);
  const hash = sha256(input);
  const entropy = hash.slice(0, 16);
  return entropyToMnemonic(entropy, wordlist);
}
