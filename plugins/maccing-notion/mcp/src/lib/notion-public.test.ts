// Unit tests for the public client's retry: shouldRetryPublic + backoffMs (pure) and the publicRequest
// loop (mocked fetch/setTimeout). No real Notion API. Run with `bun test`.

import { afterEach, beforeEach, expect, test } from "bun:test";

import { backoffMs, publicRequest, shouldRetryPublic } from "./notion-public";

// 429 — always retry regardless of method
test("429 is retried for GET", () => {
  expect(shouldRetryPublic(429, "GET")).toBe(true);
});

test("429 is retried for POST", () => {
  expect(shouldRetryPublic(429, "POST")).toBe(true);
});

test("429 is retried for PATCH", () => {
  expect(shouldRetryPublic(429, "PATCH")).toBe(true);
});

test("429 is retried for DELETE", () => {
  expect(shouldRetryPublic(429, "DELETE")).toBe(true);
});

// 503 — always retry (request not processed)
test("503 is retried for GET", () => {
  expect(shouldRetryPublic(503, "GET")).toBe(true);
});

test("503 is retried for POST", () => {
  expect(shouldRetryPublic(503, "POST")).toBe(true);
});

test("503 is retried for PATCH", () => {
  expect(shouldRetryPublic(503, "PATCH")).toBe(true);
});

// 502 — only idempotent methods (GET/HEAD)
test("502 is retried for GET", () => {
  expect(shouldRetryPublic(502, "GET")).toBe(true);
});

test("502 is retried for HEAD", () => {
  expect(shouldRetryPublic(502, "HEAD")).toBe(true);
});

test("502 is NOT retried for POST", () => {
  expect(shouldRetryPublic(502, "POST")).toBe(false);
});

test("502 is NOT retried for PATCH", () => {
  expect(shouldRetryPublic(502, "PATCH")).toBe(false);
});

test("502 is NOT retried for DELETE", () => {
  expect(shouldRetryPublic(502, "DELETE")).toBe(false);
});

test("502 is NOT retried for PUT", () => {
  expect(shouldRetryPublic(502, "PUT")).toBe(false);
});

// 2xx — never retry
test("200 is never retried", () => {
  expect(shouldRetryPublic(200, "GET")).toBe(false);
});

test("204 is never retried", () => {
  expect(shouldRetryPublic(204, "DELETE")).toBe(false);
});

// 4xx errors (other than 429) — never retry
test("400 is never retried", () => {
  expect(shouldRetryPublic(400, "POST")).toBe(false);
});

test("401 is never retried", () => {
  expect(shouldRetryPublic(401, "GET")).toBe(false);
});

test("403 is never retried", () => {
  expect(shouldRetryPublic(403, "GET")).toBe(false);
});

test("404 is never retried", () => {
  expect(shouldRetryPublic(404, "GET")).toBe(false);
});

test("409 is never retried", () => {
  expect(shouldRetryPublic(409, "POST")).toBe(false);
});

test("503 is retried for DELETE (the always-retry contract holds for every method)", () => {
  expect(shouldRetryPublic(503, "DELETE")).toBe(true);
});

// method casing — uppercase and lowercase both work
test("502 retry check is case-insensitive for 'get'", () => {
  expect(shouldRetryPublic(502, "get")).toBe(true);
});

test("502 no-retry check is case-insensitive for 'post'", () => {
  expect(shouldRetryPublic(502, "post")).toBe(false);
});

// ── backoffMs (pure) ──────────────────────────────────────────────────────────────────────────
test("backoffMs is EXPONENTIAL: 700 · 2^attempt = 700, 1400, 2800", () => {
  expect(backoffMs(0)).toBe(700);
  expect(backoffMs(1)).toBe(1400);
  expect(backoffMs(2)).toBe(2800);
});

test("backoffMs honors a positive Retry-After (seconds) over the exponential", () => {
  expect(backoffMs(0, 5)).toBe(5000);
  expect(backoffMs(2, 1)).toBe(1000);
});

test("backoffMs ignores NaN / zero / negative Retry-After, falling back to exponential", () => {
  expect(backoffMs(1, Number.NaN)).toBe(1400);
  expect(backoffMs(1, 0)).toBe(1400);
  expect(backoffMs(1, -5)).toBe(1400);
});

// ── publicRequest retry LOOP (mocked fetch + setTimeout) ──────────────────────────────────────
const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
let delays: number[] = [];

interface ScriptedResponse {
  status: number;
  retryAfter?: string;
}

/** Replace fetch with a scripted sequence (last response repeats); returns a call counter. */
function mockFetch(responses: ScriptedResponse[]): () => number {
  let index = 0;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      text: async () => "{}",
      headers: { get: (header: string) => (header === "Retry-After" ? (response.retryAfter ?? null) : null) },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return () => calls;
}

beforeEach(() => {
  delays = [];
  // record the backoff delays and fire the callback immediately (keeps the loop tests instant)
  globalThis.setTimeout = ((callback: () => void, milliseconds?: number) => {
    delays.push(milliseconds ?? 0);
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
});

test("publicRequest retries a GET on 429, then returns the success", async () => {
  const calls = mockFetch([{ status: 429 }, { status: 429 }, { status: 200 }]);
  const response = await publicRequest("GET", "/v1/x");
  expect(calls()).toBe(3);
  expect(response.status).toBe(200);
  expect(response.ok).toBe(true);
});

test("publicRequest exhausts after 4 attempts on persistent 429, returning the last", async () => {
  const calls = mockFetch([{ status: 429 }]);
  const response = await publicRequest("GET", "/v1/x");
  expect(calls()).toBe(4); // MAX_ATTEMPTS
  expect(response.status).toBe(429);
});

test("publicRequest does NOT retry a write (POST) on 502 — no double-apply", async () => {
  const calls = mockFetch([{ status: 502 }, { status: 200 }]);
  const response = await publicRequest("POST", "/v1/x", {});
  expect(calls()).toBe(1);
  expect(response.status).toBe(502);
});

test("publicRequest retries a GET on 502 then succeeds", async () => {
  const calls = mockFetch([{ status: 502 }, { status: 200 }]);
  const response = await publicRequest("GET", "/v1/x");
  expect(calls()).toBe(2);
  expect(response.status).toBe(200);
});

test("publicRequest does NOT retry a 404", async () => {
  const calls = mockFetch([{ status: 404 }, { status: 200 }]);
  const response = await publicRequest("GET", "/v1/x");
  expect(calls()).toBe(1);
  expect(response.status).toBe(404);
});

test("publicRequest backoff delays are exponential across retries", async () => {
  mockFetch([{ status: 429 }]); // persistent → 3 waits before the 4th (final) attempt
  await publicRequest("GET", "/v1/x");
  expect(delays).toEqual([700, 1400, 2800]);
});

test("publicRequest honors Retry-After over the exponential backoff", async () => {
  mockFetch([{ status: 429, retryAfter: "2" }, { status: 200 }]);
  await publicRequest("GET", "/v1/x");
  expect(delays[0]).toBe(2000);
});
