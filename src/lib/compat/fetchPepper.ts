export interface PepperResponse {
  provider: "google" | "apple";
  sub_hash: string;
  pepper: string;
}

export async function fetchPepper(): Promise<PepperResponse> {
  const res = await fetch("/api/pepper", { method: "POST" });
  if (res.status === 401) throw new Error("Not signed in");
  if (res.status === 402) throw new Error("Premium required");
  if (!res.ok) throw new Error(`Pepper API error: ${res.status}`);
  return res.json();
}
