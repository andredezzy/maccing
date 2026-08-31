import { describe, expect, test } from "bun:test";

import { request } from "./request";

/** Answer every request with 200, recording the bodies that were sent. */
function stubFetch(latencyMs = 0) {
  const sent: { path: string; body: unknown }[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input?.url ?? input);
    sent.push({ path: url.replace("https://api.notion.com", ""), body: JSON.parse(init?.body ?? "{}") });

    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    return new Response(JSON.stringify({ object: "page", id: `page-${sent.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return {
    sent,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function textOf(result: any): string {
  return (result.content ?? []).map((chunk: any) => chunk.text ?? "").join("");
}

describe("request — batch mode", () => {
  test("sends one call per body in `bodies`", async () => {
    // The case this exists for: creating a week of training rows was 18 separate
    // tool calls, each costing a full model turn to decide. The network was never
    // the problem — the round trip per row was.
    const net = stubFetch();

    try {
      await request.handler({
        method: "POST",
        path: "/v1/pages",
        bodies: [{ properties: { Name: 1 } }, { properties: { Name: 2 } }, { properties: { Name: 3 } }],
      } as any);

      expect(net.sent).toHaveLength(3);
      expect(net.sent.map((call) => (call.body as any).properties.Name)).toEqual([1, 2, 3]);
    } finally {
      net.restore();
    }
  });

  test("runs them concurrently rather than one after another", async () => {
    const net = stubFetch(60);

    try {
      const started = Date.now();
      await request.handler({
        method: "POST",
        path: "/v1/pages",
        bodies: Array.from({ length: 6 }, (_, index) => ({ properties: { Name: index } })),
      } as any);
      const elapsed = Date.now() - started;

      // Six serial 60ms calls would be ~360ms. Bounded concurrency must land
      // well under that while still respecting the cap.
      expect(elapsed).toBeLessThan(250);
    } finally {
      net.restore();
    }
  });

  test("reports each result with its index", async () => {
    const net = stubFetch();

    try {
      const result = await request.handler({
        method: "POST",
        path: "/v1/pages",
        bodies: [{ properties: {} }, { properties: {} }],
      } as any);

      const text = textOf(result);
      expect(text).toContain("2 of 2");
    } finally {
      net.restore();
    }
  });

  test("one failure does not hide the successes", async () => {
    // Partial success is the honest outcome and the caller has to see which
    // index failed — silently reporting "ok" would strand rows nobody rechecks.
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (_input: any, _init: any) => {
      calls += 1;

      if (calls === 2) {
        return new Response(JSON.stringify({ message: "validation error" }), { status: 400 });
      }

      return new Response(JSON.stringify({ object: "page", id: `page-${calls}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const result = await request.handler({
        method: "POST",
        path: "/v1/pages",
        bodies: [{ properties: {} }, { properties: {} }, { properties: {} }],
      } as any);

      const text = textOf(result);
      expect(text).toContain("2 of 3");
      expect(JSON.parse(text).results[1]).toMatchObject({ index: 1, ok: false, status: 400 });
    } finally {
      globalThis.fetch = original;
    }
  });

  test("rejects passing both body and bodies", async () => {
    const result = await request.handler({
      method: "POST",
      path: "/v1/pages",
      body: { properties: {} },
      bodies: [{ properties: {} }],
    } as any);

    expect(textOf(result)).toContain("not both");
  });
});
