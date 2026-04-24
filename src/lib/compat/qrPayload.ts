import { encrypt, decrypt } from "./crypto";

// Build the full QR URL string — matches text2qrApp format
export function buildQrUrl(plaintext: string, password: string): string {
  const ds = encrypt(plaintext, password);
  const host =
    typeof window !== "undefined" ? window.location.origin : "https://wallet2qr.com";
  return `${host}/?ds=${ds}`;
}

// Decrypt a payload extracted from a QR URL
export function decryptPayload(
  payload: string,
  password: string
): string | null {
  return decrypt(payload, password);
}
