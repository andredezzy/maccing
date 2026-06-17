// Notion page/property-value readers: plain-text extraction, the page title, and flattening a property
// value to an agent-friendly scalar (relations surfaced as ids for the caller to resolve to titles).

import type { PropertyValue } from "../notion/property-values/property-value";

export interface RichText {
  plain_text?: string;
}

// The loose hand-rolled property value is now an ALIAS of the official canon `PropertyValue` — the canon is
// the single source of truth. The readers below narrow on `property.type`, so the discriminated union flows
// through unchanged (the local FormulaValue/RollupValue casts below stay loose for the dynamic value access).
export type NotionPropertyValue = PropertyValue;

export interface NotionPageBase {
  properties?: Record<string, NotionPropertyValue>;
}

export const richTextToPlain = (richText: unknown): string =>
  Array.isArray(richText) ? (richText as RichText[]).map((part) => part.plain_text ?? "").join("") : "";

/** The page's title from whichever property is the `title` type ("Name", "Month", "title", …). */
export function titleOf(page: NotionPageBase): string {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "title") {
      return richTextToPlain(property.title) || "(untitled)";
    }
  }
  return "(untitled)";
}

export type Scalar = string | number | boolean | null;

export interface FlattenedProperty {
  value: Scalar;
  /** Present for relation properties — the target page ids to resolve to titles. */
  relationIds?: string[];
  /** True when the relation list is truncated (Notion's has_more flag) — caller should indicate partial data. */
  truncated?: boolean;
}

interface FormulaValue {
  type?: string;
  date?: { start?: string };
  [key: string]: unknown;
}

interface RollupValue {
  type?: string;
  number?: number;
  date?: { start?: string };
  array?: unknown[];
}

export interface NotionDateRange {
  start?: string;
  end?: string;
}

interface NotionPersonRef {
  name?: string;
  id?: string;
}

interface NotionUniqueId {
  prefix?: string;
  number?: number;
}

function flattenFormula(formula: unknown): Scalar {
  const formulaValue = formula as FormulaValue;
  if (!formulaValue?.type) {
    return null;
  }
  if (formulaValue.type === "date") {
    return formulaValue.date?.start ?? null;
  }
  return (formulaValue[formulaValue.type] as Scalar) ?? null;
}

function flattenRollup(rollup: unknown): Scalar {
  const rollupValue = rollup as RollupValue;
  if (rollupValue?.type === "number") {
    return rollupValue.number ?? null;
  }
  if (rollupValue?.type === "date") {
    return rollupValue.date?.start ?? null;
  }
  if (rollupValue?.type === "array") {
    return `[${(rollupValue.array ?? []).length} items]`;
  }
  return null;
}

/**
 * Convert any non-relation Notion property value to a compact display string.
 * Shared between flattenProperty (scalar reader) and flattenValue (database-model display renderer)
 * so the two callers stay in sync when new property types are added. Returns "" (never null).
 *
 * Note: checkbox renders as ☑/☐ (display use); flattenProperty returns a boolean for typed reads.
 * Note: rollup arrays render as "N item(s)" here; flattenProperty uses flattenRollup for Scalar output.
 */
export function propertyToString(property: NotionPropertyValue): string {
  switch (property.type) {
    case "title":
      return richTextToPlain(property.title);
    case "rich_text":
      return richTextToPlain(property.rich_text);
    case "number":
      return property.number == null ? "" : String(property.number);
    case "checkbox":
      return property.checkbox ? "☑" : "☐";
    case "select":
      return (property.select as { name?: string })?.name ?? "";
    case "status":
      return (property.status as { name?: string })?.name ?? "";
    case "multi_select":
      return ((property.multi_select as { name?: string }[]) ?? []).map((option) => option.name).join(", ");
    case "date": {
      const dateRange = property.date as NotionDateRange | null;
      return dateRange?.start ? (dateRange.end ? `${dateRange.start} → ${dateRange.end}` : dateRange.start) : "";
    }
    case "people":
      return ((property.people as NotionPersonRef[]) ?? []).map((person) => person.name ?? person.id ?? "").join(", ");
    case "email":
      return (property.email as string) ?? "";
    case "phone_number":
      return (property.phone_number as string) ?? "";
    case "url":
      return (property.url as string) ?? "";
    case "files":
      return ((property.files as { name?: string }[]) ?? []).map((file) => file.name ?? "").join(", ");
    case "created_time":
      return (property.created_time as string) ?? "";
    case "last_edited_time":
      return (property.last_edited_time as string) ?? "";
    case "unique_id": {
      const uniqueId = property.unique_id as NotionUniqueId | null;
      return uniqueId?.number != null ? `${uniqueId.prefix ? `${uniqueId.prefix}-` : ""}${uniqueId.number}` : "";
    }
    case "created_by":
      return (property.created_by as { name?: string })?.name ?? "";
    case "last_edited_by":
      return (property.last_edited_by as { name?: string })?.name ?? "";
    case "rollup": {
      const rollup = property.rollup as { type?: string; [key: string]: unknown };
      if (!rollup?.type) {
        return "";
      }
      const value = rollup[rollup.type];
      if (value == null) {
        return "";
      }
      return Array.isArray(value) ? `${value.length} item(s)` : String(value);
    }
    case "formula": {
      const formulaValue = property.formula as FormulaValue | null;
      if (!formulaValue?.type) {
        return "";
      }
      if (formulaValue.type === "date") {
        const dateRange = formulaValue.date as NotionDateRange | null;
        return dateRange?.start ? (dateRange.end ? `${dateRange.start} → ${dateRange.end}` : dateRange.start) : "";
      }
      const formulaScalar = formulaValue[formulaValue.type] as Scalar | undefined;
      if (formulaScalar == null) {
        return "";
      }
      if (typeof formulaScalar === "boolean") {
        return formulaScalar ? "☑" : "☐";
      }
      return String(formulaScalar);
    }
    default:
      return "";
  }
}

/** Flatten one Notion property value to a scalar (relations return their ids for later title resolution). */
export function flattenProperty(property: NotionPropertyValue): FlattenedProperty {
  switch (property.type) {
    case "title":
      return { value: richTextToPlain(property.title) };
    case "rich_text":
      return { value: richTextToPlain(property.rich_text) };
    case "number":
      return { value: (property.number as number) ?? null };
    case "checkbox":
      return { value: (property.checkbox as boolean) ?? false };
    case "select":
      return { value: (property.select as { name?: string })?.name ?? null };
    case "status":
      return { value: (property.status as { name?: string })?.name ?? null };
    case "multi_select":
      return {
        value: ((property.multi_select as { name?: string }[]) ?? []).map((option) => option.name).join(", ") || null,
      };
    case "date": {
      const dateRange = property.date as NotionDateRange | null;
      return {
        value: dateRange?.start ? (dateRange.end ? `${dateRange.start} → ${dateRange.end}` : dateRange.start) : null,
      };
    }
    case "people":
      return {
        value:
          ((property.people as NotionPersonRef[]) ?? []).map((person) => person.name ?? person.id).join(", ") || null,
      };
    case "email":
      return { value: (property.email as string) ?? null };
    case "phone_number":
      return { value: (property.phone_number as string) ?? null };
    case "url":
      return { value: (property.url as string) ?? null };
    case "files":
      return {
        value: ((property.files as { name?: string }[]) ?? []).map((file) => file.name).join(", ") || null,
      };
    case "created_time":
      return { value: (property.created_time as string) ?? null };
    case "last_edited_time":
      return { value: (property.last_edited_time as string) ?? null };
    case "unique_id": {
      const uniqueId = property.unique_id as NotionUniqueId | null;
      return {
        value: uniqueId?.number != null ? `${uniqueId.prefix ? `${uniqueId.prefix}-` : ""}${uniqueId.number}` : null,
      };
    }
    case "created_by":
      return { value: (property.created_by as { name?: string })?.name ?? null };
    case "last_edited_by":
      return { value: (property.last_edited_by as { name?: string })?.name ?? null };
    case "relation": {
      const hasMore = (property as { has_more?: boolean }).has_more;
      return {
        value: null,
        relationIds: ((property.relation as { id?: string }[]) ?? [])
          .map((relation) => relation.id)
          .filter((id): id is string => Boolean(id)),
        ...(hasMore ? { truncated: true } : {}),
      };
    }
    case "rollup":
      return { value: flattenRollup(property.rollup) };
    case "formula":
      return { value: flattenFormula(property.formula) };
    default:
      return { value: null };
  }
}
