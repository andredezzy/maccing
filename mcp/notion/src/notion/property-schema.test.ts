// mirrors developers.notion.com/reference/property-object — column definition schema tests
import { expect, test } from "bun:test";
import { propertySchema } from "./property-schema";

// One fixture per documented column type (doc-verified 2026-06-16).
const cases: unknown[] = [
  // title — exactly one required per data source; empty config
  { id: "a", name: "Name", type: "title", title: {} },

  // rich_text — empty config
  { id: "b", name: "Notes", type: "rich_text", rich_text: {} },

  // number — format required
  { id: "c", name: "Est", type: "number", number: { format: "number" } },

  // select — options array
  { id: "d", name: "Status", type: "select", select: { options: [{ id: "o1", name: "Done", color: "green" }] } },

  // multi_select — same option shape
  { id: "e", name: "Tags", type: "multi_select", multi_select: { options: [{ name: "urgent" }] } },

  // status — options + groups
  {
    id: "f",
    name: "State",
    type: "status",
    status: {
      options: [{ id: "o2", name: "In progress", color: "blue" }],
      groups: [{ id: "g1", name: "In progress", color: "blue", option_ids: ["o2"] }],
    },
  },

  // date — empty config
  { id: "g", name: "Due", type: "date", date: {} },

  // people — empty config
  { id: "h", name: "Assignee", type: "people", people: {} },

  // files — empty config
  { id: "i", name: "Attachments", type: "files", files: {} },

  // checkbox — empty config
  { id: "j", name: "Done?", type: "checkbox", checkbox: {} },

  // url — empty config
  { id: "k", name: "Link", type: "url", url: {} },

  // email — empty config
  { id: "l", name: "Email", type: "email", email: {} },

  // phone_number — empty config
  { id: "m", name: "Phone", type: "phone_number", phone_number: {} },

  // relation — data_source_id required; dual_property optional
  { id: "n", name: "Tasks", type: "relation", relation: { data_source_id: "ds-1", type: "dual_property" } },

  // formula — expression required
  { id: "o", name: "Formula", type: "formula", formula: { expression: 'prop("Est") * 2' } },

  // rollup — function required; property refs optional
  {
    id: "p",
    name: "Total",
    type: "rollup",
    rollup: { relation_property_name: "Tasks", rollup_property_name: "Est", function: "sum" },
  },

  // created_time — empty config
  { id: "q", name: "Created", type: "created_time", created_time: {} },

  // created_by — empty config
  { id: "r", name: "Creator", type: "created_by", created_by: {} },

  // last_edited_time — empty config
  { id: "s", name: "Edited", type: "last_edited_time", last_edited_time: {} },

  // last_edited_by — empty config
  { id: "t", name: "Editor", type: "last_edited_by", last_edited_by: {} },

  // unique_id — prefix optional (live doc: config has prefix field)
  { id: "u", name: "ID", type: "unique_id", unique_id: { prefix: "TASK" } },

  // button — empty config
  { id: "v", name: "Action", type: "button", button: {} },

  // verification — empty config
  { id: "w", name: "Verified", type: "verification", verification: {} },

  // place — documented with empty config (API support limited but type is present in the doc)
  { id: "x", name: "Location", type: "place", place: {} },

  // id is OPTIONAL — hand-authored proposals omit it
  { name: "My Column", type: "checkbox", checkbox: {} },

  // description is OPTIONAL
  { name: "Another", type: "url", url: {}, description: "link to source" },
];

test("propertySchema parses every documented column type", () => {
  for (const fixture of cases) {
    expect(() => propertySchema.parse(fixture), JSON.stringify(fixture)).not.toThrow();
  }
});

test("propertySchema surfaces the discriminated config — number format", () => {
  const parsed = propertySchema.parse({ name: "Est", type: "number", number: { format: "dollar" } });
  expect(parsed.type === "number" && parsed.number.format).toBe("dollar");
});

test("propertySchema surfaces the discriminated config — select options", () => {
  const parsed = propertySchema.parse({
    name: "Priority",
    type: "select",
    select: { options: [{ name: "High", color: "red" }] },
  });
  expect(parsed.type === "select" && parsed.select.options[0].name).toBe("High");
});

test("propertySchema surfaces the discriminated config — status groups", () => {
  const parsed = propertySchema.parse({
    name: "State",
    type: "status",
    status: {
      options: [{ name: "Todo" }],
      groups: [{ name: "Not started", color: "default", option_ids: [] }],
    },
  });
  expect(parsed.type === "status" && parsed.status.groups?.[0].name).toBe("Not started");
});

test("propertySchema surfaces the discriminated config — formula expression", () => {
  const parsed = propertySchema.parse({ name: "F", type: "formula", formula: { expression: "now()" } });
  expect(parsed.type === "formula" && parsed.formula.expression).toBe("now()");
});

test("propertySchema surfaces the discriminated config — rollup function", () => {
  const parsed = propertySchema.parse({
    name: "R",
    type: "rollup",
    rollup: { relation_property_id: "rel-id", rollup_property_id: "prop-id", function: "count" },
  });
  expect(parsed.type === "rollup" && parsed.rollup.function).toBe("count");
});

test("propertySchema rejects an unknown type", () => {
  expect(() => propertySchema.parse({ name: "X", type: "bogus", bogus: {} })).toThrow();
});

test("propertySchema rejects a missing name", () => {
  expect(() => propertySchema.parse({ type: "checkbox", checkbox: {} })).toThrow();
});

test("propertySchema rejects a select without options", () => {
  expect(() => propertySchema.parse({ name: "S", type: "select", select: {} })).toThrow();
});

test("propertySchema rejects a number without format", () => {
  expect(() => propertySchema.parse({ name: "N", type: "number", number: {} })).toThrow();
});

test("propertySchema rejects a formula without expression", () => {
  expect(() => propertySchema.parse({ name: "F", type: "formula", formula: {} })).toThrow();
});

test("propertySchema rejects a rollup without function", () => {
  expect(() => propertySchema.parse({ name: "R", type: "rollup", rollup: { relation_property_name: "x" } })).toThrow();
});
