export interface PepperResponse {
  provider: "google" | "apple";
  sub_hash: string;
  pepper: string;
}

export async function fetchPepper(): Promise<PepperResponse> {
  const res = await fetch("/api/pepper", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error ?? `Pepper API error: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}
