import { encrypt, decrypt, encryptV2, decryptV2 } from "./crypto";
import type { EncryptionMode, V3EncryptResult } from "./cryptoV3";

export interface V1Envelope {
  v: 1;
  ds: string;
}

export interface V2Envelope {
  v: 2;
  ds: string;
  pep: string;
  sh: string;
}

export interface V3Envelope {
  v: 3;
  ds: string;
  m: EncryptionMode;
  s: string;
  p?: string;
  ph?: string;
  w1?: string;
  w2?: string;
  ct: number;
}

export type Envelope = V1Envelope | V2Envelope | V3Envelope;

// --- v1 (legacy, password-only) ---

export function buildQrUrl(plaintext: string, password: string): string {
  const ds = encrypt(plaintext, password);
  const host =
    typeof window !== "undefined" ? window.location.origin : "https://www.wallet2qr.com";
  return `${host}/?ds=${ds}`;
}

// --- v2 (legacy, server-side pepper) ---

export function buildQrUrlV2(
  plaintext: string,
  password: string,
  pepper: string,
  provider: string,
  subHash: string
): string {
  const ds = encryptV2(plaintext, password, pepper);
  const host =
    typeof window !== "undefined" ? window.location.origin : "https://www.wallet2qr.com";
  return `${host}/?ds=${ds}&v=2&pep=${provider}&sh=${subHash}`;
}

// --- v3 (Argon2id + AES-GCM, client-side stable IDs) ---

export function buildQrUrlV3(result: V3EncryptResult): string {
  const host =
    typeof window !== "undefined" ? window.location.origin : "https://www.wallet2qr.com";
  const params = new URLSearchParams();
  params.set("v", "3");
  params.set("ds", result.ciphertext);
  params.set("s", result.salt);
  params.set("m", result.mode);
  if (result.provider) params.set("p", result.provider);
  if (result.providerIdHash) params.set("ph", result.providerIdHash);
  if (result.wrappedKey1) params.set("w1", result.wrappedKey1);
  if (result.wrappedKey2) params.set("w2", result.wrappedKey2);
  params.set("ct", String(result.createdAt));
  return `${host}/?${params.toString()}`;
}

// --- Envelope parser (all versions) ---

export function parseEnvelope(url: string): Envelope {
  try {
    const u = new URL(url);
    const ds = u.searchParams.get("ds") ?? "";
    const v = u.searchParams.get("v");

    if (v === "3") {
      return {
        v: 3,
        ds,
        m: (u.searchParams.get("m") || "a") as EncryptionMode,
        s: u.searchParams.get("s") ?? "",
        p: u.searchParams.get("p") || undefined,
        ph: u.searchParams.get("ph") || undefined,
        w1: u.searchParams.get("w1") || undefined,
        w2: u.searchParams.get("w2") || undefined,
        ct: parseInt(u.searchParams.get("ct") || "0", 10),
      };
    }

    if (v === "2") {
      return {
        v: 2,
        ds,
        pep: u.searchParams.get("pep") ?? "google",
        sh: u.searchParams.get("sh") ?? "",
      };
    }

    return { v: 1, ds };
  } catch {
    const dsMatch = url.match(/[?&]ds=([^&]*)/);
    return { v: 1, ds: dsMatch ? dsMatch[1] : url };
  }
}

// --- v1/v2 decrypt helpers (unchanged) ---

export function decryptPayload(
  payload: string,
  password: string
): string | null {
  return decrypt(payload, password);
}

export function decryptPayloadV2(
  payload: string,
  password: string,
  pepper: string
): string | null {
  return decryptV2(payload, password, pepper);
}
