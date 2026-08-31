import { beforeEach, describe, expect, test } from "bun:test";

import { __resetRelationTitleCache, resolveRelations } from "./resolve-relations";

// Each fetched id is recorded so a test can assert what actually hit the network,
// which is the whole point: the cache is only worth having if it removes requests.
function stubFetch(titles: Record<string, string>) {
  const fetched: string[] = [];

  const original = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = String(input?.url ?? input);
    const id = url.split("/v1/pages/")[1] ?? "";
    fetched.push(id);

    return new Response(
      JSON.stringify({
        object: "page",
        id,
        properties: { Name: { type: "title", title: [{ plain_text: titles[id] ?? "?" }] } },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  return {
    fetched,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("resolveRelations", () => {
  beforeEach(() => {
    __resetRelationTitleCache();
  });

  test("resolves ids to titles", async () => {
    const net = stubFetch({ [A]: "Machine Chest Press" });

    try {
      const titles = await resolveRelations([A]);

      expect(titles.get(A)).toBe("Machine Chest Press");
    } finally {
      net.restore();
    }
  });

  test("a repeated id is fetched once, not once per call", async () => {
    // The case that hurts: a training log names the same exercises every week, so
    // the same handful of relation targets is re-fetched on every read. One GET
    // each is the ceiling worth paying.
    const net = stubFetch({ [A]: "Machine Chest Press", [B]: "Chest" });

    try {
      await resolveRelations([A, B]);
      await resolveRelations([A, B]);
      await resolveRelations([A]);

      expect(net.fetched).toEqual([A, B]);
    } finally {
      net.restore();
    }
  });

  test("a cached title still comes back on later calls", async () => {
    const net = stubFetch({ [A]: "Machine Chest Press" });

    try {
      await resolveRelations([A]);
      const second = await resolveRelations([A]);

      expect(second.get(A)).toBe("Machine Chest Press");
    } finally {
      net.restore();
    }
  });

  test("a missing target is not cached as a title", async () => {
    // A 404 means "gone right now" — it must not pin "[deleted]" onto an id that
    // a later share or restore would make readable again.
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (input: any) => {
      calls += 1;
      const id = String(input?.url ?? input).split("/v1/pages/")[1] ?? "";

      if (calls === 1) {
        return new Response("{}", { status: 404 });
      }

      return new Response(
        JSON.stringify({
          object: "page",
          id,
          properties: { Name: { type: "title", title: [{ plain_text: "Back" }] } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const first = await resolveRelations([A]);
      const second = await resolveRelations([A]);

      expect(first.get(A)).toBe("[deleted]");
      expect(second.get(A)).toBe("Back");
    } finally {
      globalThis.fetch = original;
    }
  });
});
