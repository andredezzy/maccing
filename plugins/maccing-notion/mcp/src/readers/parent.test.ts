// Pure unit tests for parentLabel — the parent-ref → human label shared by describe/search and the
// AGENTS.md parent-chain climb. Run with `bun test`.

import { expect, test } from "bun:test";

import { parentLabel } from "./parent";

const ID = "abcdef0123456789"; // 16 chars → abbreviated to abcdef01…6789

test("parentLabel renders each parent type with an abbreviated id", () => {
  expect(parentLabel({ type: "page_id", page_id: ID })).toBe("page abcdef01…6789");
  expect(parentLabel({ type: "data_source_id", data_source_id: ID })).toBe("data_source abcdef01…6789");
  expect(parentLabel({ type: "database_id", database_id: ID })).toBe("database abcdef01…6789");
  expect(parentLabel({ type: "block_id", block_id: ID })).toBe("block abcdef01…6789");
});

test("parentLabel handles a missing id, workspace, an unknown type, and an absent parent", () => {
  expect(parentLabel({ type: "page_id" })).toBe("page"); // type present, id missing
  expect(parentLabel({ type: "workspace" })).toBe("workspace"); // default branch → the raw type
  expect(parentLabel({})).toBe("—"); // no type → em dash
  expect(parentLabel(undefined)).toBe("—"); // absent parent
});
