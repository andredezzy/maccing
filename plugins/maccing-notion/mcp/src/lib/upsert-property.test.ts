// Pure unit tests for the upsert-property planners — no Notion API. Run with `bun test`.

import { expect, test } from "bun:test";

import {
  buildIconOperations,
  iconAssetPath,
  parseCollectionIcons,
  planUpserts,
  type ResolvedEntry,
  type SaveOp,
} from "./upsert-property";

test("iconAssetPath builds /icons/<file>_<color>.svg, default gray", () => {
  expect(iconAssetPath("cash")).toBe("/icons/cash_gray.svg");
  expect(iconAssetPath("calendar-day", "blue")).toBe("/icons/calendar-day_blue.svg");
});

test("planUpserts routes a data_source entry to a schema PATCH + an icon op", () => {
  const entries: ResolvedEntry[] = [
    {
      targetId: "ds1",
      targetType: "data_source",
      property: "Value",
      value: { number: { format: "real" } },
      icon: "currency-coin",
    },
  ];
  const plan = planUpserts(entries);
  expect(plan.dataSourcePatches.ds1.Value).toEqual({ number: { format: "real" } });
  expect(plan.iconPlan).toEqual([
    { dataSourceId: "ds1", property: "Value", iconValue: "/icons/currency-coin_gray.svg" },
  ]);
  expect(plan.errors).toEqual([]);
});

test("planUpserts routes a page entry to a page-value PATCH (never an icon op)", () => {
  const plan = planUpserts([
    { targetId: "pg1", targetType: "page", property: "Status", value: { status: { name: "Done" } } },
  ]);
  expect(plan.pagePatches.pg1.Status).toEqual({ status: { name: "Done" } });
  expect(plan.iconPlan).toEqual([]);
});

test("planUpserts rejects an icon on a page target with a clear error, and emits no icon op", () => {
  const plan = planUpserts([{ targetId: "pg1", targetType: "page", property: "Status", icon: "cash" }]);
  expect(plan.errors).toHaveLength(1);
  expect(plan.errors[0]).toContain("page");
  expect(plan.iconPlan).toEqual([]);
});

test("planUpserts: remove deletes a column (null) and clears a page value (null)", () => {
  const plan = planUpserts([
    { targetId: "ds1", targetType: "data_source", property: "Old", remove: true },
    { targetId: "pg1", targetType: "page", property: "Note", remove: true },
  ]);
  expect(plan.dataSourcePatches.ds1.Old).toBeNull();
  expect(plan.pagePatches.pg1.Note).toBeNull();
});

test("planUpserts: removeIcon clears a column's icon (data_source only)", () => {
  const plan = planUpserts([{ targetId: "ds1", targetType: "data_source", property: "X", removeIcon: true }]);
  expect(plan.iconPlan).toEqual([{ dataSourceId: "ds1", property: "X", iconValue: null }]);
});

test("planUpserts merges multiple entries for the same target into one patch", () => {
  const plan = planUpserts([
    { targetId: "ds1", targetType: "data_source", property: "A", value: { number: {} } },
    { targetId: "ds1", targetType: "data_source", property: "B", value: { checkbox: {} } },
  ]);
  expect(Object.keys(plan.dataSourcePatches.ds1)).toEqual(["A", "B"]);
});

test("buildIconOperations emits a schema op per icon + one commit per data source", () => {
  const ops: SaveOp[] = buildIconOperations(
    [
      { dataSourceId: "ds1", propertyId: "abc", iconValue: "/icons/cash_gray.svg" },
      { dataSourceId: "ds1", propertyId: "def", iconValue: null },
      { dataSourceId: "ds2", propertyId: "ghi", iconValue: "/icons/tag_gray.svg" },
    ],
    "space1",
    "user1",
  );
  expect(ops.filter((op) => op.command === "update")).toHaveLength(2); // one commit per distinct ds
  const setOp = ops.find((op) => op.path[1] === "abc");
  expect(setOp?.command).toBe("updateCollectionPropertySchema");
  expect((setOp?.args.primitiveOp as { args: unknown }).args).toBe("/icons/cash_gray.svg");
  const removeOp = ops.find((op) => op.path[1] === "def");
  expect((removeOp?.args.primitiveOp as { args: unknown }).args).toBeNull();
});

test("parseCollectionIcons maps each collection's schema to {propId: icon}", () => {
  const body = {
    results: [
      { value: { schema: { abc: { icon: "/icons/cash_gray.svg" }, def: { name: "X" } } } },
      { value: { schema: { ghi: { icon: "/icons/tag_gray.svg" } } } },
    ],
  };
  const out = parseCollectionIcons(body, ["ds1", "ds2"]);
  expect(out.ds1).toEqual({ abc: "/icons/cash_gray.svg" });
  expect(out.ds2).toEqual({ ghi: "/icons/tag_gray.svg" });
});
