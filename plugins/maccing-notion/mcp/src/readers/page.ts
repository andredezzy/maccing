// Notion page/property-value readers: plain-text extraction, the page title, and flattening a property
// value to an agent-friendly scalar (relations surfaced as ids for the caller to resolve to titles).

export interface RichText {
  plain_text?: string;
}

export interface NotionPropertyValue {
  type: string;
  [key: string]: unknown;
}

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
    case "relation":
      return {
        value: null,
        relationIds: ((property.relation as { id?: string }[]) ?? [])
          .map((relation) => relation.id)
          .filter((id): id is string => Boolean(id)),
      };
    case "rollup":
      return { value: flattenRollup(property.rollup) };
    case "formula":
      return { value: flattenFormula(property.formula) };
    default:
      return { value: null };
  }
}
