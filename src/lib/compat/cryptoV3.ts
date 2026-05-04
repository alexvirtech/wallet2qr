import { argon2id } from "hash-wasm";
import { sha256 } from "@noble/hashes/sha256";

export type EncryptionMode = "a" | "b" | "c" | "d";

export interface Argon2Params {
  memorySize: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
}

// OWASP recommended: 64 MB, 3 iterations, 1 parallelism
export const ARGON2_PARAMS: Argon2Params = {
  memorySize: 65536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

// Reduced params for fast unit tests — NOT for production
export const ARGON2_TEST_PARAMS: Argon2Params = {
  memorySize: 1024,
  iterations: 1,
  parallelism: 1,
  hashLength: 32,
};

// --- Utility ---

export function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function generateBackupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .match(/.{4}/g)!
    .join("-");
}

export function computeProviderIdHash(stableId: string): string {
  const hash = sha256(new TextEncoder().encode(stableId));
  return base64urlEncode(hash.slice(0, 16));
}

// --- Key derivation ---

export function checkWasmSupport(): { supported: boolean; reason?: string } {
  if (typeof WebAssembly === "undefined") {
    return { supported: false, reason: "WebAssembly not available (Lockdown Mode or old browser)" };
  }
  if (typeof WebAssembly.instantiate !== "function") {
    return { supported: false, reason: "WebAssembly.instantiate not available" };
  }
  return { supported: true };
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  factor?: string,
  params: Argon2Params = ARGON2_PARAMS
): Promise<Uint8Array> {
  const wasmCheck = checkWasmSupport();
  if (!wasmCheck.supported) {
    throw new Error(`Cannot derive key: ${wasmCheck.reason}`);
  }

  const input = factor ? password + "|" + factor : password;
  try {
    const result = await argon2id({
      password: input,
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memorySize,
      hashLength: params.hashLength,
      outputType: "binary",
    });
    return new Uint8Array(result);
  } catch (e) {
    console.error("[cryptoV3] argon2id failed:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Key derivation failed: ${errMsg}. ` +
      (typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "iOS may block WASM — try disabling Lockdown Mode or use a desktop browser."
        : "WASM execution error — try a different browser.")
    );
  }
}

// --- AES-256-GCM via WebCrypto ---

function toBuffer(arr: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return buf;
}

async function aesGcmEncrypt(
  plaintext: Uint8Array,
  keyBytes: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    "raw",
    toBuffer(keyBytes),
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toBuffer(plaintext)
  );
  const result = new Uint8Array(12 + ct.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ct), 12);
  return result;
}

async function aesGcmDecrypt(
  data: Uint8Array,
  keyBytes: Uint8Array
): Promise<Uint8Array | null> {
  try {
    const iv = data.slice(0, 12);
    const ct = data.slice(12);
    const key = await crypto.subtle.importKey(
      "raw",
      toBuffer(keyBytes),
      "AES-GCM",
      false,
      ["decrypt"]
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      toBuffer(ct)
    );
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

// --- Encrypt ---

export interface V3EncryptResult {
  mode: EncryptionMode;
  ciphertext: string;
  salt: string;
  provider?: string;
  providerIdHash?: string;
  wrappedKey1?: string;
  wrappedKey2?: string;
  backupCode?: string;
  createdAt: number;
}

export async function encryptV3(
  plaintext: string,
  password: string,
  options: {
    mode: EncryptionMode;
    providerStableId?: string;
    provider?: string;
    backupCode?: string;
  },
  params: Argon2Params = ARGON2_PARAMS
): Promise<V3EncryptResult> {
  const salt = generateSalt();
  const saltB64 = base64urlEncode(salt);
  const ptBytes = new TextEncoder().encode(plaintext);
  const createdAt = Math.floor(Date.now() / 1000);

  if (options.mode === "a") {
    const key = await deriveKey(password, salt, undefined, params);
    const encrypted = await aesGcmEncrypt(ptBytes, key);
    key.fill(0);
    return { mode: "a", ciphertext: base64urlEncode(encrypted), salt: saltB64, createdAt };
  }

  if (options.mode === "b") {
    if (!options.providerStableId || !options.provider)
      throw new Error("Provider stable ID required for mode b");
    const key = await deriveKey(password, salt, options.providerStableId, params);
    const encrypted = await aesGcmEncrypt(ptBytes, key);
    key.fill(0);
    return {
      mode: "b",
      ciphertext: base64urlEncode(encrypted),
      salt: saltB64,
      provider: options.provider,
      providerIdHash: computeProviderIdHash(options.providerStableId),
      createdAt,
    };
  }

  if (options.mode === "c") {
    const backupCode = options.backupCode || generateBackupCode();
    const key = await deriveKey(password, salt, backupCode, params);
    const encrypted = await aesGcmEncrypt(ptBytes, key);
    key.fill(0);
    return {
      mode: "c",
      ciphertext: base64urlEncode(encrypted),
      salt: saltB64,
      backupCode,
      createdAt,
    };
  }

  // Mode D: DEK-wrapping for dual unlock paths (social OR backup)
  if (!options.providerStableId || !options.provider)
    throw new Error("Provider stable ID required for mode d");
  const backupCode = options.backupCode || generateBackupCode();

  const dek = crypto.getRandomValues(new Uint8Array(32));
  const encrypted = await aesGcmEncrypt(ptBytes, dek);

  const [key1, key2] = await Promise.all([
    deriveKey(password, salt, options.providerStableId, params),
    deriveKey(password, salt, backupCode, params),
  ]);

  const wrappedKey1 = await aesGcmEncrypt(dek, key1);
  const wrappedKey2 = await aesGcmEncrypt(dek, key2);

  dek.fill(0);
  key1.fill(0);
  key2.fill(0);

  return {
    mode: "d",
    ciphertext: base64urlEncode(encrypted),
    salt: saltB64,
    provider: options.provider,
    providerIdHash: computeProviderIdHash(options.providerStableId),
    wrappedKey1: base64urlEncode(wrappedKey1),
    wrappedKey2: base64urlEncode(wrappedKey2),
    backupCode,
    createdAt,
  };
}

// --- Decrypt ---

export async function decryptV3(
  ciphertextB64: string,
  password: string,
  saltB64: string,
  options: {
    mode: EncryptionMode;
    providerStableId?: string;
    backupCode?: string;
    wrappedKey1B64?: string;
    wrappedKey2B64?: string;
  },
  params: Argon2Params = ARGON2_PARAMS
): Promise<string | null> {
  const salt = base64urlDecode(saltB64);
  const ciphertext = base64urlDecode(ciphertextB64);

  if (options.mode === "a") {
    const key = await deriveKey(password, salt, undefined, params);
    const pt = await aesGcmDecrypt(ciphertext, key);
    key.fill(0);
    return pt ? new TextDecoder().decode(pt) : null;
  }

  if (options.mode === "b") {
    if (!options.providerStableId) return null;
    const key = await deriveKey(password, salt, options.providerStableId, params);
    const pt = await aesGcmDecrypt(ciphertext, key);
    key.fill(0);
    return pt ? new TextDecoder().decode(pt) : null;
  }

  if (options.mode === "c") {
    if (!options.backupCode) return null;
    const key = await deriveKey(password, salt, options.backupCode, params);
    const pt = await aesGcmDecrypt(ciphertext, key);
    key.fill(0);
    return pt ? new TextDecoder().decode(pt) : null;
  }

  // Mode D: try social unlock, then backup
  if (options.providerStableId && options.wrappedKey1B64) {
    const key1 = await deriveKey(password, salt, options.providerStableId, params);
    const wrappedKey1 = base64urlDecode(options.wrappedKey1B64);
    const dek = await aesGcmDecrypt(wrappedKey1, key1);
    key1.fill(0);
    if (dek) {
      const pt = await aesGcmDecrypt(ciphertext, dek);
      dek.fill(0);
      return pt ? new TextDecoder().decode(pt) : null;
    }
  }

  if (options.backupCode && options.wrappedKey2B64) {
    const key2 = await deriveKey(password, salt, options.backupCode, params);
    const wrappedKey2 = base64urlDecode(options.wrappedKey2B64);
    const dek = await aesGcmDecrypt(wrappedKey2, key2);
    key2.fill(0);
    if (dek) {
      const pt = await aesGcmDecrypt(ciphertext, dek);
      dek.fill(0);
      return pt ? new TextDecoder().decode(pt) : null;
    }
  }

  return null;
}
