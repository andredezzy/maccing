// Unit tests for resolveRelations — the relation-id → title resolver — over a scripted fetch.
// setTimeout is stubbed so publicRequest's 429 backoff fires instantly. Run with `bun test`.

import { afterEach, beforeEach, expect, test } from "bun:test";

import { resolveRelations } from "./resolve-relations";

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;

beforeEach(() => {
  globalThis.setTimeout = ((callback: () => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
});

interface PageScript {
  status?: number;
  title?: string;
}

/** Mock GET /v1/pages/{id} per id: a title (→ 200 + title-prop body) or a status (e.g. 404, 429). */
function mockPages(byId: Record<string, PageScript>): void {
  globalThis.fetch = (async (url: string | URL) => {
    const id = String(url).split("/v1/pages/")[1] ?? "";
    const entry = byId[id] ?? { status: 404 };
    const status = entry.status ?? 200;
    const body =
      entry.title !== undefined
        ? { properties: { Name: { type: "title", title: [{ plain_text: entry.title }] } } }
        : {};
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(body),
      headers: { get: () => null },
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

test("resolveRelations dedups ids and maps each to its page title", async () => {
  mockPages({ a: { title: "Alpha" }, b: { title: "Beta" } });
  const map = await resolveRelations(["a", "a", "b", ""]); // duplicate + empty filtered out
  expect(map.get("a")).toBe("Alpha");
  expect(map.get("b")).toBe("Beta");
  expect(map.size).toBe(2);
});

test("resolveRelations marks a 404/403 target as [deleted]", async () => {
  mockPages({ gone: { status: 404 } });
  expect((await resolveRelations(["gone"])).get("gone")).toBe("[deleted]");
});

test("resolveRelations throws on a 429 so the caller can back off", async () => {
  mockPages({ x: { status: 429 } });
  await expect(resolveRelations(["x"])).rejects.toThrow(/rate limit/i);
});
