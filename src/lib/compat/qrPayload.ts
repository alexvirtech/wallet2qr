import { encrypt, decrypt, encryptV2, decryptV2 } from "./crypto";

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

export type Envelope = V1Envelope | V2Envelope;

export function buildQrUrl(plaintext: string, password: string): string {
  const ds = encrypt(plaintext, password);
  const host =
    typeof window !== "undefined" ? window.location.origin : "https://www.wallet2qr.com";
  return `${host}/?ds=${ds}`;
}

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

export function parseEnvelope(url: string): Envelope {
  try {
    const u = new URL(url);
    const ds = u.searchParams.get("ds") ?? "";
    const v = u.searchParams.get("v");
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
