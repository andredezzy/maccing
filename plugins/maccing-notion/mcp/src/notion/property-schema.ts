// mirrors developers.notion.com/reference/property-object — data source column definitions
// These are SCHEMA objects (column configs), NOT page property VALUES (those live in property-values/).
import { z } from "zod";

// Server-generated id is OPTIONAL so hand-authored proposals validate without it.
const base = {
  id: z.string().optional(),
  name: z.string(),
  description: z.unknown().optional(),
};

// Reused across select, multi_select, and status — id is absent on hand-authored options.
const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
});

// status groups each reference a set of option ids.
const statusGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
  option_ids: z.array(z.string()).optional(),
});

// Named configs for types with ≥2 config fields.

const selectConfig = z.object({ options: z.array(optionSchema) });

const statusConfig = z.object({
  options: z.array(optionSchema),
  groups: z.array(statusGroupSchema).optional(),
});

const numberConfig = z.object({ format: z.string() });

const formulaConfig = z.object({ expression: z.string() });

const relationConfig = z.object({
  data_source_id: z.string(),
  type: z.string().optional(),
  single_property: z.record(z.string(), z.unknown()).optional(),
  dual_property: z.record(z.string(), z.unknown()).optional(),
});

const rollupConfig = z.object({
  relation_property_name: z.string().optional(),
  relation_property_id: z.string().optional(),
  rollup_property_name: z.string().optional(),
  rollup_property_id: z.string().optional(),
  function: z.string(),
});

const uniqueIdConfig = z.object({ prefix: z.string().nullable().optional() });

// Empty-config value-only types use a passthrough record so extra API fields are tolerated.
const emptyConfig = z.record(z.string(), z.unknown());

export const propertySchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("title"), title: emptyConfig }),
  z.object({ ...base, type: z.literal("rich_text"), rich_text: emptyConfig }),
  z.object({ ...base, type: z.literal("number"), number: numberConfig }),
  z.object({ ...base, type: z.literal("select"), select: selectConfig }),
  z.object({ ...base, type: z.literal("multi_select"), multi_select: selectConfig }),
  z.object({ ...base, type: z.literal("status"), status: statusConfig }),
  z.object({ ...base, type: z.literal("date"), date: emptyConfig }),
  z.object({ ...base, type: z.literal("people"), people: emptyConfig }),
  z.object({ ...base, type: z.literal("files"), files: emptyConfig }),
  z.object({ ...base, type: z.literal("checkbox"), checkbox: emptyConfig }),
  z.object({ ...base, type: z.literal("url"), url: emptyConfig }),
  z.object({ ...base, type: z.literal("email"), email: emptyConfig }),
  z.object({ ...base, type: z.literal("phone_number"), phone_number: emptyConfig }),
  z.object({ ...base, type: z.literal("formula"), formula: formulaConfig }),
  z.object({ ...base, type: z.literal("relation"), relation: relationConfig }),
  z.object({ ...base, type: z.literal("rollup"), rollup: rollupConfig }),
  z.object({ ...base, type: z.literal("created_time"), created_time: emptyConfig }),
  z.object({ ...base, type: z.literal("created_by"), created_by: emptyConfig }),
  z.object({ ...base, type: z.literal("last_edited_time"), last_edited_time: emptyConfig }),
  z.object({ ...base, type: z.literal("last_edited_by"), last_edited_by: emptyConfig }),
  z.object({ ...base, type: z.literal("unique_id"), unique_id: uniqueIdConfig }),
  // button (triggers automations) and verification (verified-state, used in wikis) are real Notion
  // database column types — they appear in the page-property-values reference and are addable columns,
  // even though the property-object enumeration page lists them only tersely. Empty config.
  z.object({ ...base, type: z.literal("button"), button: emptyConfig }),
  z.object({ ...base, type: z.literal("verification"), verification: emptyConfig }),
  // place — documented on the live reference page (API support limited); empty config
  z.object({ ...base, type: z.literal("place"), place: emptyConfig }),
]);

export type PropertySchema = z.infer<typeof propertySchema>;
