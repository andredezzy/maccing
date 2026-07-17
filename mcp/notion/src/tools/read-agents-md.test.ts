// Session-cache behavior for read_agents_md: a repeat sweep of an unchanged AGENTS.md playbook collapses
// to a one-line marker instead of re-emitting the full text. Run with `bun test`.

import { afterEach, expect, test } from "bun:test";
import { playbookCache, readAgentsMd } from "./read-agents-md";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  playbookCache.clear();
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  } as unknown as Response;
}

const TARGET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const AGENTS_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LAST_EDITED = "2026-01-01T00:00:00.000Z";

/** A single-ancestor chain: TARGET_ID is the root and carries one AGENTS.md child page. */
function mockSingleAgentsMdAncestry(markdown: string): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (/\/v1\/blocks\/[^/?]+\/children/.test(u)) {
      return jsonResponse(200, {
        results: [
          { id: AGENTS_ID, type: "child_page", child_page: { title: "AGENTS.md" }, last_edited_time: LAST_EDITED },
        ],
        has_more: false,
      });
    }
    if (u.endsWith("/markdown")) {
      return jsonResponse(200, { markdown });
    }
    if (u.includes(`/v1/pages/${TARGET_ID}`)) {
      return jsonResponse(200, {
        properties: { title: { type: "title", title: [{ plain_text: "Root" }] } },
        parent: {},
      });
    }
    return jsonResponse(404, {});
  }) as unknown as typeof fetch;
}

test("first sweep of a session always emits the full playbook text", async () => {
  mockSingleAgentsMdAncestry("# Hello\nOriginal text");
  const result = await readAgentsMd.handler({ id: TARGET_ID });
  const text = (result.content[0] as { text: string }).text;
  expect(text).toContain("Original text");
  expect(text).not.toContain("unchanged since this session's earlier sweep");
});

test("a repeat sweep of an unchanged playbook emits a one-line marker plus a trailing note", async () => {
  mockSingleAgentsMdAncestry("# Hello\nOriginal text");
  await readAgentsMd.handler({ id: TARGET_ID }); // first sweep populates the cache

  const result = await readAgentsMd.handler({ id: TARGET_ID }); // second sweep, same content
  const text = (result.content[0] as { text: string }).text;

  expect(text).toContain(
    `[unchanged since this session's earlier sweep · last_edited ${LAST_EDITED}] rank 1/1 · Root · ${AGENTS_ID}`,
  );
  expect(text).not.toContain("Original text");
  expect(text).toContain("unchanged playbooks: the text from this session's earlier sweep still governs.");
});

test("a changed playbook emits full text again on the next sweep, not the marker", async () => {
  mockSingleAgentsMdAncestry("# Hello\nOriginal text");
  await readAgentsMd.handler({ id: TARGET_ID }); // first sweep

  mockSingleAgentsMdAncestry("# Hello\nEdited text"); // content changed before the next sweep
  const result = await readAgentsMd.handler({ id: TARGET_ID });
  const text = (result.content[0] as { text: string }).text;

  expect(text).toContain("Edited text");
  expect(text).not.toContain("unchanged since this session's earlier sweep");
});

test("no unchanged-note line appears when every playbook is fresh", async () => {
  mockSingleAgentsMdAncestry("# Hello\nOriginal text");
  const result = await readAgentsMd.handler({ id: TARGET_ID });
  const text = (result.content[0] as { text: string }).text;
  expect(text).not.toContain("unchanged playbooks:");
});
