// Pure unit tests for the upsert-property planners — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import { describePrivateFailure, parseCollectionIcons } from "../notion/private-client";
import {
  buildIconOperations,
  iconAssetPath,
  planUpserts,
  type ResolvedEntry,
  type SaveOp,
  TargetType,
} from "./upsert-property";

test("describePrivateFailure: connection reset / bot page → a throttle message that says public changes applied", () => {
  for (const body of [
    "The socket connection was closed unexpectedly",
    "Private API unreachable (likely throttled / bot-protection reset): socket hang up",
    "Non-JSON response (likely rate-limited / bot page — space out private calls and retry).",
  ]) {
    const message = describePrivateFailure(body);
    expect(message).toContain("throttled");
    expect(message).toMatch(/DID apply|retry/i);
    expect(message).not.toContain("socket"); // raw error not leaked
  }
});

test("describePrivateFailure: a real API error is surfaced verbatim-ish, not masked as a throttle", () => {
  const message = describePrivateFailure({ code: "validation_error", message: "bad icon path" });
  expect(message).not.toContain("throttled");
  expect(message).toContain("validation_error");
});

test("iconAssetPath builds /icons/<file>_<color>.svg, default gray", () => {
  expect(iconAssetPath("cash")).toBe("/icons/cash_gray.svg");
  expect(iconAssetPath("calendar-day", "blue")).toBe("/icons/calendar-day_blue.svg");
});

test("planUpserts routes a data_source entry to a schema PATCH + an icon op", () => {
  const entries: ResolvedEntry[] = [
    {
      targetId: "ds1",
      targetType: TargetType.DATA_SOURCE,
      property: "Value",
      value: { number: { format: "real" } },
      icon: "currency-coin",
    },
  ];
  const plan = planUpserts(entries);
  expect(plan.dataSourcePatches.ds1.Value).toEqual({ number: { format: "real" } });
  expect(plan.iconPlan).toEqual([
    { dataSourceId: "ds1", property: "Value", iconAssetPath: "/icons/currency-coin_gray.svg" },
  ]);
  expect(plan.errors).toEqual([]);
});

test("planUpserts routes a page entry to a page-value PATCH (never an icon op)", () => {
  const plan = planUpserts([
    { targetId: "pg1", targetType: TargetType.PAGE, property: "Status", value: { status: { name: "Done" } } },
  ]);
  expect(plan.pagePatches.pg1.Status).toEqual({ status: { name: "Done" } });
  expect(plan.iconPlan).toEqual([]);
});

test("planUpserts rejects an icon on a page target with a clear error, and emits no icon op", () => {
  const plan = planUpserts([{ targetId: "pg1", targetType: TargetType.PAGE, property: "Status", icon: "cash" }]);
  expect(plan.errors).toHaveLength(1);
  expect(plan.errors[0]).toContain("page");
  expect(plan.iconPlan).toEqual([]);
});

test("planUpserts collects a canonical visibility change for a data_source property", () => {
  const plan = planUpserts([{ targetId: "ds1", targetType: TargetType.DATA_SOURCE, property: "X", visible: false }]);
  expect(plan.visiblePlan).toEqual([{ dataSourceId: "ds1", property: "X", visible: false }]);
});

test("planUpserts rejects `visible` on a page target (a value has no visibility)", () => {
  const plan = planUpserts([{ targetId: "pg1", targetType: TargetType.PAGE, property: "Status", visible: true }]);
  expect(plan.errors).toHaveLength(1);
  expect(plan.visiblePlan).toEqual([]);
});

test("planUpserts: remove deletes a column (null) and clears a page value (null)", () => {
  const plan = planUpserts([
    { targetId: "ds1", targetType: TargetType.DATA_SOURCE, property: "Old", remove: true, icon: "cash" },
    { targetId: "pg1", targetType: TargetType.PAGE, property: "Note", remove: true },
  ]);
  expect(plan.dataSourcePatches.ds1.Old).toBeNull();
  expect(plan.pagePatches.pg1.Note).toBeNull();
  expect(plan.iconPlan).toEqual([]); // removing a column short-circuits any icon op (the `continue`)
});

test("planUpserts: removeIcon clears a column's icon (data_source only)", () => {
  const plan = planUpserts([{ targetId: "ds1", targetType: TargetType.DATA_SOURCE, property: "X", removeIcon: true }]);
  expect(plan.iconPlan).toEqual([{ dataSourceId: "ds1", property: "X", iconAssetPath: null }]);
});

test("planUpserts merges multiple entries for the same target into one patch", () => {
  const plan = planUpserts([
    { targetId: "ds1", targetType: TargetType.DATA_SOURCE, property: "A", value: { number: {} } },
    { targetId: "ds1", targetType: TargetType.DATA_SOURCE, property: "B", value: { checkbox: {} } },
  ]);
  expect(Object.keys(plan.dataSourcePatches.ds1)).toEqual(["A", "B"]);
});

test("buildIconOperations emits a schema op per icon + one commit per data source", () => {
  const operations: SaveOp[] = buildIconOperations(
    [
      { dataSourceId: "ds1", propertyId: "abc", iconAssetPath: "/icons/cash_gray.svg" },
      { dataSourceId: "ds1", propertyId: "def", iconAssetPath: null },
      { dataSourceId: "ds2", propertyId: "ghi", iconAssetPath: "/icons/tag_gray.svg" },
    ],
    "space1",
    "user1",
  );
  expect(operations.filter((operation) => operation.command === "update")).toHaveLength(2); // one commit per distinct ds
  const setOperation = operations.find((operation) => operation.path[1] === "abc");
  expect(setOperation?.command).toBe("updateCollectionPropertySchema");
  expect((setOperation?.args.primitiveOp as { args: unknown }).args).toBe("/icons/cash_gray.svg");
  const removeOperation = operations.find((operation) => operation.path[1] === "def");
  expect((removeOperation?.args.primitiveOp as { args: unknown }).args).toBeNull();
});

test("parseCollectionIcons maps each collection's schema to {propertyId: icon}", () => {
  const body = {
    results: [
      { value: { schema: { abc: { icon: "/icons/cash_gray.svg" }, def: { name: "X" } } } },
      { value: { schema: { ghi: { icon: "/icons/tag_gray.svg" } } } },
    ],
  };
  const result = parseCollectionIcons(body, ["ds1", "ds2"]);
  expect(result.ds1).toEqual({ abc: "/icons/cash_gray.svg" });
  expect(result.ds2).toEqual({ ghi: "/icons/tag_gray.svg" });
});
