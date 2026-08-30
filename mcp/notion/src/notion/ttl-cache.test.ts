import { describe, expect, mock, test } from "bun:test";

import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  test("a miss computes, a hit inside the TTL does not", async () => {
    const compute = mock(async () => "value");
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 8 });

    expect(await cache.resolve("k", compute)).toBe("value");
    expect(await cache.resolve("k", compute)).toBe("value");

    expect(compute).toHaveBeenCalledTimes(1);
  });

  test("an expired entry recomputes", async () => {
    let n = 0;
    const compute = async () => `v${++n}`;
    const now = { t: 0 };
    const cache = new TtlCache<string>({ ttlMs: 100, maxEntries: 8, clock: () => now.t });

    expect(await cache.resolve("k", compute)).toBe("v1");
    now.t = 101;
    expect(await cache.resolve("k", compute)).toBe("v2");
  });

  test("distinct keys do not share an entry", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 8 });

    expect(await cache.resolve("a", async () => "A")).toBe("A");
    expect(await cache.resolve("b", async () => "B")).toBe("B");
  });

  test("a rejected compute is not cached", async () => {
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 8 });

    expect(cache.resolve("k", async () => {
      throw new Error("upstream down");
    })).rejects.toThrow("upstream down");

    // The failure must not poison the key: the next call gets a real answer.
    expect(await cache.resolve("k", async () => "recovered")).toBe("recovered");
  });

  test("concurrent callers on one key share a single compute", async () => {
    const compute = mock(async () => {
      await Bun.sleep(20);
      return "shared";
    });
    const cache = new TtlCache<string>({ ttlMs: 1000, maxEntries: 8 });

    const all = await Promise.all([
      cache.resolve("k", compute),
      cache.resolve("k", compute),
      cache.resolve("k", compute),
    ]);

    expect(all).toEqual(["shared", "shared", "shared"]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test("the cache is bounded and evicts the oldest entry", async () => {
    const cache = new TtlCache<string>({ ttlMs: 10_000, maxEntries: 2 });
    const compute = mock(async () => "v");

    await cache.resolve("a", compute);
    await cache.resolve("b", compute);
    await cache.resolve("c", compute); // evicts "a"
    await cache.resolve("a", compute); // recomputes

    expect(compute).toHaveBeenCalledTimes(4);
  });

  test("a zero TTL disables caching rather than caching forever", async () => {
    const compute = mock(async () => "v");
    const cache = new TtlCache<string>({ ttlMs: 0, maxEntries: 8 });

    await cache.resolve("k", compute);
    await cache.resolve("k", compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });
});
