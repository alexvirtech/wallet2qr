import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

const SALT = "wallet2qr-pep-v1";

const DEV_MASTER = "dGVzdC1tYXN0ZXItc2VjcmV0LTMyLWJ5dGVzISEh"; // 32 bytes base64

function getMasterKey(): Uint8Array {
  const envVal = process.env.WALLET2QR_PEPPER_MASTER;
  if (envVal) {
    return Uint8Array.from(atob(envVal), (c) => c.charCodeAt(0));
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("WALLET2QR_PEPPER_MASTER is required in production");
  }
  if (!globalThis.__pepperDevWarned) {
    console.warn("[pepper] WALLET2QR_PEPPER_MASTER not set — using dev test value");
    globalThis.__pepperDevWarned = true;
  }
  return Uint8Array.from(atob(DEV_MASTER), (c) => c.charCodeAt(0));
}

declare let globalThis: { __pepperDevWarned?: boolean } & typeof global;

export function derivePepper(provider: string, sub: string): string {
  const ikm = getMasterKey();
  const info = new TextEncoder().encode(`${provider}|${sub}`);
  const salt = new TextEncoder().encode(SALT);
  const pepperBytes = hkdf(sha256, ikm, salt, info, 32);
  return btoa(String.fromCharCode(...pepperBytes));
}

export function subHash(sub: string): string {
  const hash = sha256(new TextEncoder().encode(sub));
  const truncated = hash.slice(0, 16);
  return btoa(String.fromCharCode(...truncated))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

