// Integration tests for the live-bundle assembly — the fetch + order + sample step behind render_mockup's
// page_id/database_id paths. `globalThis.fetch` is mocked with realistic API-shaped responses and restored
// after each test (no module-registry leak — same approach as resolve-relations.test.ts), so these run
// offline and prove: the children-fetch loop nests children into the block payload, the database assembly
// orders/selects/samples, and the assembled bundle renders through the real renderer (no overflow).

import { afterEach, beforeEach, expect, test } from "bun:test";
import { displayWidth, render } from "../render";
import { fetchDatabaseRender, fetchPageRender } from "./live-bundle";

interface FakeResponse {
  ok: boolean;
  status: number;
  body: unknown;
}
type Route = (method: string, path: string) => FakeResponse;
let route: Route = () => ({ ok: false, status: 404, body: {} });

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;

beforeEach(() => {
  globalThis.setTimeout = ((callback: () => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.fetch = (async (url: string | URL, options?: { method?: string }) => {
    const path = String(url)
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/\?.*$/, ""); // strip origin + query string → bare /v1/... path
    const response = route((options?.method ?? "GET").toUpperCase(), path);
    return { ok: response.ok, status: response.status, text: async () => JSON.stringify(response.body) } as Response;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
});

const rt = (content: string) => ({ type: "text", text: { content }, plain_text: content });
const okBody = (body: unknown): FakeResponse => ({ ok: true, status: 200, body });

test("fetchPageRender fetches the page + nested block tree, and it renders", async () => {
  route = (_method, path) => {
    if (path === "/v1/pages/PAGE") {
      return okBody({
        object: "page",
        icon: { type: "emoji", emoji: "📄" },
        properties: { Name: { type: "title", title: [rt("Trip Plan")] } },
      });
    }
    if (path === "/v1/blocks/PAGE/children") {
      return okBody({
        results: [
          { type: "heading_1", id: "h1", has_children: false, heading_1: { rich_text: [rt("Day 1")] } },
          { type: "toggle", id: "t1", has_children: true, toggle: { rich_text: [rt("Details")] } },
        ],
        has_more: false,
      });
    }
    if (path === "/v1/blocks/t1/children") {
      return okBody({
        results: [{ type: "paragraph", id: "p1", has_children: false, paragraph: { rich_text: [rt("Pack bags")] } }],
        has_more: false,
      });
    }
    return { ok: false, status: 404, body: {} };
  };

  const bundle = await fetchPageRender("PAGE", 3);
  expect(bundle).not.toBeNull();
  // The toggle's child must be NESTED into the toggle payload (not attached at the block top level).
  const toggle = bundle?.blocks.find((block) => block.type === "toggle") as { toggle?: { children?: unknown[] } };
  expect(toggle?.toggle?.children).toHaveLength(1);

  const out = render(bundle as Parameters<typeof render>[0]);
  expect(out).toContain("Trip Plan"); // page title
  expect(out).toContain("Day 1"); // heading
  expect(out).toContain("Details"); // toggle
  expect(out).toContain("Pack bags"); // nested child
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70); // nothing overflows the canvas
  }
});

test("fetchPageRender returns null when the page can't be read", async () => {
  route = () => ({ ok: false, status: 404, body: {} });
  expect(await fetchPageRender("MISSING", 1)).toBeNull();
});

test("fetchPageRender EXPANDS an inline child_database into its default-view grid (always, by default)", async () => {
  route = (method, path) => {
    if (path === "/v1/pages/PAGE") {
      return okBody({ object: "page", properties: { Name: { type: "title", title: [rt("Gym")] } } });
    }
    if (path === "/v1/blocks/PAGE/children") {
      return okBody({
        results: [
          { type: "child_database", id: "INLINE_DS", has_children: false, child_database: { title: "Training Log" } },
        ],
        has_more: false,
      });
    }
    // fetchDatabaseRender("INLINE_DS"): /databases/INLINE_DS 404s → id treated as a data source; wrapper resolved via parent.
    if (method === "GET" && path === "/v1/data_sources/INLINE_DS") {
      return okBody({
        object: "data_source",
        parent: { type: "database_id", database_id: "INLINE_DB" },
        properties: {
          Name: { id: "nm", name: "Name", type: "title", title: {} },
          Volume: { id: "vol", name: "Volume", type: "rich_text", rich_text: {} },
        },
      });
    }
    if (method === "GET" && path === "/v1/databases/INLINE_DB") {
      return okBody({ object: "database", title: [rt("Training Log")], icon: { type: "emoji", emoji: "🏋" } });
    }
    if (method === "GET" && path === "/v1/views") {
      return okBody({ results: [{ id: "vw1" }], has_more: false });
    }
    if (method === "GET" && path === "/v1/views/vw1") {
      return okBody({
        id: "vw1",
        name: "Sessions",
        type: "table",
        parent: { database_id: "INLINE_DB" },
        configuration: { properties: [{ property_id: "nm" }, { property_id: "vol" }] },
      });
    }
    if (method === "POST" && path === "/v1/data_sources/INLINE_DS/query") {
      return okBody({
        results: [
          {
            object: "page",
            properties: {
              Name: { type: "title", title: [rt("Push day")] },
              Volume: { type: "rich_text", rich_text: [rt("4 210")] },
            },
          },
        ],
        has_more: false,
      });
    }
    return { ok: false, status: 404, body: {} }; // /databases/INLINE_DS 404s → resolver treats the id as a data source
  };

  const bundle = await fetchPageRender("PAGE", 3);
  expect(bundle).not.toBeNull();
  const dbBlock = bundle?.blocks.find((block) => block.type === "child_database") as {
    child_database?: { render?: { bundle?: { rows?: unknown[] } } };
  };
  expect(dbBlock?.child_database?.render?.bundle?.rows).toHaveLength(1); // the inline DB was fetched + attached

  const out = render(bundle as Parameters<typeof render>[0]);
  expect(out).toContain("▦ Training Log"); // inline heading
  expect(out).toContain("Volume"); // a column from the expanded grid
  expect(out).toContain("Push day"); // a row cell — grid expanded inline, not a bare ▦ reference
  expect(out).toContain("┌"); // an actual box
});

test("fetchDatabaseRender assembles a live database (schema + views + rows) and it renders", async () => {
  route = (method, path) => {
    if (method === "GET" && path === "/v1/databases/DB") {
      return okBody({ object: "database", title: [rt("Tasks")], icon: { type: "emoji", emoji: "✅" } });
    }
    if (method === "GET" && path === "/v1/data_sources/DS") {
      return okBody({
        object: "data_source",
        parent: { type: "database_id", database_id: "DB" },
        properties: {
          Name: { id: "tA", name: "Name", type: "title", title: {} },
          Status: {
            id: "sB",
            name: "Status",
            type: "select",
            select: { options: [{ name: "Todo" }, { name: "Done" }] },
          },
        },
      });
    }
    if (method === "GET" && path === "/v1/views") {
      return okBody({ results: [{ id: "v1" }], has_more: false }); // listViewIds → just ids
    }
    if (method === "GET" && path === "/v1/views/v1") {
      return okBody({
        id: "v1",
        name: "Board",
        type: "table",
        parent: { database_id: "DB" },
        configuration: { properties: [{ property_id: "tA" }, { property_id: "sB" }] },
      });
    }
    if (method === "POST" && path === "/v1/data_sources/DS/query") {
      return okBody({
        results: [
          {
            object: "page",
            properties: {
              Name: { type: "title", title: [rt("Ship v1")] },
              Status: { type: "select", select: { name: "Done" } },
            },
          },
          {
            object: "page",
            properties: {
              Name: { type: "title", title: [rt("Write docs")] },
              Status: { type: "select", select: { name: "Todo" } },
            },
          },
        ],
        has_more: false,
      });
    }
    return { ok: false, status: 404, body: {} }; // /v1/databases/DS 404s → resolver treats the id as a data source
  };

  const live = await fetchDatabaseRender("DS", undefined);
  expect(live).not.toBeNull();
  expect(live?.bundle.rows).toHaveLength(2);

  const out = render(live?.bundle as Parameters<typeof render>[0], undefined, live?.selectedIndex);
  expect(out).toContain("Tasks"); // database title (resolved via the data source's parent)
  expect(out).toContain("Name"); // resolved column name (property_id → name)
  expect(out).toContain("Ship v1"); // a row cell
  expect(out).toContain("Done"); // a select cell value
  for (const line of out.split("\n")) {
    expect(displayWidth(line)).toBeLessThanOrEqual(70);
  }
});
