// Pure unit tests for parentLabel — the parent-ref → human label shared by describe/search and the
// AGENTS.md parent-chain climb. Run with `bun test`.

import { expect, test } from "bun:test";

import { parentLabel } from "./parent";

const ID = "abcdef0123456789"; // ids are surfaced in FULL — never abbreviated

test("parentLabel renders each parent type with its full id", () => {
  expect(parentLabel({ type: "page_id", page_id: ID })).toBe(`page ${ID}`);
  expect(parentLabel({ type: "data_source_id", data_source_id: ID })).toBe(`data_source ${ID}`);
  expect(parentLabel({ type: "database_id", database_id: ID })).toBe(`database ${ID}`);
  expect(parentLabel({ type: "block_id", block_id: ID })).toBe(`block ${ID}`);
});

test("parentLabel handles a missing id, workspace, an unknown type, and an absent parent", () => {
  expect(parentLabel({ type: "page_id" })).toBe("page"); // type present, id missing
  expect(parentLabel({ type: "workspace" })).toBe("workspace"); // default branch → the raw type
  expect(parentLabel({})).toBe("—"); // no type → em dash
  expect(parentLabel(undefined)).toBe("—"); // absent parent
});
