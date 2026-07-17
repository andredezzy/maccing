// schema:'full'|'none' behavior for read_database — 'none' omits the # Schema section, # Views unchanged.
// Run with `bun test`.

import { afterEach, expect, test } from "bun:test";
import { readDatabase } from "./read-database";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  } as unknown as Response;
}

const DB_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function mockDatabase(): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("/v1/databases/")) {
      return jsonResponse(404, {}); // force the optimistic fallback: treat DB_ID as a data_source_id
    }
    if (/\/v1\/data_sources\/[^/]+\/query$/.test(u)) {
      return jsonResponse(200, {
        results: [{ id: "row1", properties: { Name: { type: "title", title: [{ plain_text: "Alpha" }] } } }],
        has_more: false,
      });
    }
    if (/\/v1\/data_sources\/[^/?]+$/.test(u)) {
      return jsonResponse(200, { properties: { Name: { id: "title", name: "Name", type: "title" } } });
    }
    if (u.includes("/v1/views")) {
      return jsonResponse(200, { results: [], has_more: false });
    }
    return jsonResponse(404, {});
  }) as unknown as typeof fetch;
}

test("schema omitted defaults to 'full' — the # Schema section is included", async () => {
  mockDatabase();
  const result = await readDatabase.handler({ database_id: DB_ID, format: "table" });
  const text = (result.content[0] as { text: string }).text;
  expect(text).toContain("# Schema (1 columns)");
  expect(text).toContain("# Views");
});

test("schema:'none' omits the # Schema section but keeps # Views", async () => {
  mockDatabase();
  const result = await readDatabase.handler({ database_id: DB_ID, format: "table", schema: "none" });
  const text = (result.content[0] as { text: string }).text;
  expect(text).not.toContain("# Schema");
  expect(text).toContain("# Views");
});
