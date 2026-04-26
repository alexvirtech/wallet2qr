const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000;

let count = 0;
let windowStart = Date.now();

export function checkClientRateLimit(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    count = 0;
    windowStart = now;
  }
  count++;
  return count <= MAX_REQUESTS;
}

export function rateLimitedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!checkClientRateLimit()) {
    return Promise.reject(new Error("Rate limit exceeded — too many requests. Try again in a minute."));
  }
  return fetch(input, init);
}
