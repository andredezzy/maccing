// Shared helpers for reading Notion page/property objects into agent-friendly scalars.

interface RichText {
  plain_text?: string;
}

export interface RawProperty {
  type: string;
  [key: string]: unknown;
}

export interface PageWithProps {
  properties?: Record<string, RawProperty>;
}

const joinText = (rt: unknown): string =>
  Array.isArray(rt) ? (rt as RichText[]).map((t) => t.plain_text ?? "").join("") : "";

/** The page's title from whichever property is the `title` type ("Name", "Month", "title", …). */
export function titleOf(page: PageWithProps): string {
  for (const prop of Object.values(page.properties ?? {})) {
    if (prop.type === "title") {
      return joinText(prop.title) || "(untitled)";
    }
  }
  return "(untitled)";
}

export type Scalar = string | number | boolean | null;

export interface Flattened {
  value: Scalar;
  /** Present for relation properties — the target page ids to resolve to titles. */
  relationIds?: string[];
}

function flattenFormula(formula: unknown): Scalar {
  const f = formula as { type?: string; date?: { start?: string } } & Record<string, Scalar>;
  if (!f?.type) {
    return null;
  }
  if (f.type === "date") {
    return f.date?.start ?? null;
  }
  return (f[f.type] as Scalar) ?? null;
}

function flattenRollup(rollup: unknown): Scalar {
  const r = rollup as { type?: string; number?: number; date?: { start?: string }; array?: unknown[] };
  if (r?.type === "number") {
    return r.number ?? null;
  }
  if (r?.type === "date") {
    return r.date?.start ?? null;
  }
  if (r?.type === "array") {
    return `[${(r.array ?? []).length} items]`;
  }
  return null;
}

/** Flatten one Notion property value to a scalar (relations return their ids for later title resolution). */
export function flattenProperty(prop: RawProperty): Flattened {
  switch (prop.type) {
    case "title":
      return { value: joinText(prop.title) };
    case "rich_text":
      return { value: joinText(prop.rich_text) };
    case "number":
      return { value: (prop.number as number) ?? null };
    case "checkbox":
      return { value: (prop.checkbox as boolean) ?? false };
    case "select":
      return { value: (prop.select as { name?: string })?.name ?? null };
    case "status":
      return { value: (prop.status as { name?: string })?.name ?? null };
    case "multi_select":
      return { value: ((prop.multi_select as { name?: string }[]) ?? []).map((s) => s.name).join(", ") || null };
    case "date": {
      const d = prop.date as { start?: string; end?: string } | null;
      return { value: d?.start ? (d.end ? `${d.start} → ${d.end}` : d.start) : null };
    }
    case "people":
      return {
        value: ((prop.people as { name?: string; id?: string }[]) ?? []).map((x) => x.name ?? x.id).join(", ") || null,
      };
    case "email":
      return { value: (prop.email as string) ?? null };
    case "phone_number":
      return { value: (prop.phone_number as string) ?? null };
    case "url":
      return { value: (prop.url as string) ?? null };
    case "files":
      return { value: ((prop.files as { name?: string }[]) ?? []).map((f) => f.name).join(", ") || null };
    case "created_time":
      return { value: (prop.created_time as string) ?? null };
    case "last_edited_time":
      return { value: (prop.last_edited_time as string) ?? null };
    case "relation":
      return { value: null, relationIds: ((prop.relation as { id: string }[]) ?? []).map((r) => r.id) };
    case "rollup":
      return { value: flattenRollup(prop.rollup) };
    case "formula":
      return { value: flattenFormula(prop.formula) };
    default:
      return { value: null };
  }
}
