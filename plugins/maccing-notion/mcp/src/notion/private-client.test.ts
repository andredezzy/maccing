// Unit tests for the private-client retry primitive. Proves a transient throttle — especially the
// cold-start bot window on the FIRST api/v3 call after process start — self-heals within budget, and that a
// longer transient needs a bigger budget (why the session warm-up is more patient than a normal call). The
// cold-start flake: every inline DB's view-order read awaits one shared getSpaces; if its budget is too small
// the whole page loses its Notion view order at once. setTimeout is mocked so backoff is instant. `bun test`.

import { afterEach, beforeEach, expect, test } from "bun:test";

import { isThrottle, retryPrivate, throttleCooldownMs, WARMUP_RETRIES } from "./private-client";

const realSetTimeout = globalThis.setTimeout;
beforeEach(() => {
  globalThis.setTimeout = ((callback: () => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
});
afterEach(() => {
  globalThis.setTimeout = realSetTimeout;
});

/** A fake transport that returns a bot-page failure `failures` times, then succeeds. */
function flaky(failures: number) {
  let calls = 0;
  const attempt = async () => {
    calls += 1;
    return calls <= failures
      ? { status: 0, ok: false, body: "Private API unreachable (likely throttled / bot-protection reset)" }
      : { status: 200, ok: true, body: { ok: true } };
  };
  return { attempt, calls: () => calls };
}

test("retryPrivate recovers when the call succeeds within the budget", async () => {
  const transport = flaky(2); // fails twice, succeeds on the 3rd attempt
  const response = await retryPrivate(transport.attempt, 3);
  expect(response.ok).toBe(true);
  expect(transport.calls()).toBe(3);
});

test("retryPrivate gives up after exactly maxRetries attempts (backs off, never hammers forever)", async () => {
  const transport = flaky(99); // always fails
  const response = await retryPrivate(transport.attempt, 3);
  expect(response.ok).toBe(false);
  expect(transport.calls()).toBe(3);
});

test("a long cold-start transient needs the patient warm-up budget — a normal 3-attempt call gives up", async () => {
  const transient = 4; // the cold-start bot window clears only on the 5th attempt
  expect((await retryPrivate(flaky(transient).attempt, 3)).ok).toBe(false); // a normal call gives up → the flake
  expect((await retryPrivate(flaky(transient).attempt, WARMUP_RETRIES)).ok).toBe(true); // the warm-up survives it
});

test("isThrottle: bot-protection (socket drop / 429 / 503 / bot-page body) trips the cooldown; a real error doesn't", () => {
  // Throttles — these GROW the global cooldown so the next call backs off.
  expect(isThrottle({ status: 0, ok: false, body: "Private API unreachable (likely throttled / reset)" })).toBe(true);
  expect(isThrottle({ status: 429, ok: false, body: { message: "rate limited" } })).toBe(true);
  expect(isThrottle({ status: 503, ok: false, body: "Service Unavailable" })).toBe(true);
  expect(isThrottle({ status: 200, ok: false, body: "Non-JSON response (likely bot page)" })).toBe(true);
  // Not throttles — a success, or a genuine JSON validation error (must NOT grow the cooldown).
  expect(isThrottle({ status: 200, ok: true, body: { ok: true } })).toBe(false);
  expect(isThrottle({ status: 400, ok: false, body: { message: "body.operations should be an array" } })).toBe(false);
});

test("throttleCooldownMs grows exponentially per consecutive throttle and caps", () => {
  expect(throttleCooldownMs(1)).toBe(1_000); // first throttle → 1s
  expect(throttleCooldownMs(2)).toBe(2_000); // doubles each time
  expect(throttleCooldownMs(3)).toBe(4_000);
  expect(throttleCooldownMs(4)).toBe(8_000);
  expect(throttleCooldownMs(99)).toBe(30_000); // capped — never an unbounded wait
});
