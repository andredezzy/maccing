// Pure unit tests for the pick-path projection util. Run with `bun test`.

import { expect, test } from "bun:test";
import { pickPaths } from "./pick";

test("projects a simple dot path", () => {
  expect(
    pickPaths({ recordMap: { collection: { c1: { value: { schema: { title: {} } } } } } }, [
      "recordMap.collection.c1.value.schema",
    ]),
  ).toEqual({ "recordMap.collection.c1.value.schema": { title: {} } });
});

test("missing path resolves to null, not a throw", () => {
  expect(pickPaths({ a: { b: 1 } }, ["a.c.d"])).toEqual({ "a.c.d": null });
});

test("[] maps the rest of the path over an array", () => {
  const body = {
    results: [
      { id: "1", name: "a" },
      { id: "2", name: "b" },
    ],
  };
  expect(pickPaths(body, ["results[].id"])).toEqual({ "results[].id": ["1", "2"] });
});

test("a trailing [] with no further key returns the array itself", () => {
  const body = { results: [1, 2, 3] };
  expect(pickPaths(body, ["results[]"])).toEqual({ "results[]": [1, 2, 3] });
});

test("nested [] segments map over arrays of arrays", () => {
  const body = { groups: [{ items: [{ id: "a" }, { id: "b" }] }, { items: [{ id: "c" }] }] };
  expect(pickPaths(body, ["groups[].items[].id"])).toEqual({ "groups[].items[].id": [["a", "b"], ["c"]] });
});

test("[] on a non-array value resolves to null", () => {
  expect(pickPaths({ results: { not: "an array" } }, ["results[].id"])).toEqual({ "results[].id": null });
});

test("resolves multiple paths into one flat map keyed by literal path string", () => {
  const body = { status: "ok", results: [{ id: "1" }] };
  expect(pickPaths(body, ["status", "results[].id"])).toEqual({ status: "ok", "results[].id": ["1"] });
});

test("a path segment that is itself uuid-shaped (hyphens, no dots) is treated as one key", () => {
  const body = { recordMap: { collection: { "37c99f0d-0a4a-8183-8b2c-000c97b6d0d0": { value: { schema: "x" } } } } };
  expect(pickPaths(body, ["recordMap.collection.37c99f0d-0a4a-8183-8b2c-000c97b6d0d0.value.schema"])).toEqual({
    "recordMap.collection.37c99f0d-0a4a-8183-8b2c-000c97b6d0d0.value.schema": "x",
  });
});

test("a null or primitive top-level value never throws", () => {
  expect(pickPaths(null, ["a.b"])).toEqual({ "a.b": null });
  expect(pickPaths("just a string", ["a.b"])).toEqual({ "a.b": null });
});
