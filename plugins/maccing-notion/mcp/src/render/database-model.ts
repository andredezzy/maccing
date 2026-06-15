// Live auto-mapper: a Notion database's (already id-resolved) views + sample rows → a DatabaseModel
// that render_mockup can draw. PURE (no API calls) so it is unit-testable; the read_database tool
// does the fetching; resolving a raw view + its rows into a renderable model is all pure and lives here.
// Unknown view types fall back to a table.

import { decodePropertyId } from "../notion/ids";
import { type NotionDateRange, richTextToPlain } from "../readers/page";
import type { PropertiesMap } from "../readers/schema";
import type { IdToName, RawView } from "../readers/views";
import type { DatabaseModel, GalleryCard, ViewBlock } from "./model";

/** A raw Notion property value (one entry of a page's `properties`). */
interface RawProp {
  type?: string;
  [key: string]: unknown;
}
export interface RawRow {
  properties?: Record<string, RawProp>;
}
interface NotionUniqueId {
  prefix?: string;
  number?: number;
}
/** A view with its property IDs already resolved to names by the caller. */
export interface ResolvedView {
  name: string;
  type: string;
  columns: string[]; // visible column NAMES (title first)
  groupBy?: string; // board group-by column name
  groupOptions?: string[]; // board: every group-by option name, in order (seeds empty columns too)
  dateProp?: string; // calendar/timeline date column name
}

/** A dominant board column would tower over its siblings — cap the visible cards, keep the true count. */
const BOARD_CARD_CAP = 6;
interface DbInput {
  title: string;
  icon?: string;
  titleColumn: string;
  views: ResolvedView[];
  rows: RawRow[];
}

/** Flatten a Notion property value to a compact display string. */
export function flattenValue(prop: RawProp | undefined): string {
  if (!prop) {
    return "";
  }
  switch (prop.type) {
    case "title":
    case "rich_text":
      return richTextToPlain(prop[prop.type]);
    case "number":
      return prop.number == null ? "" : String(prop.number);
    case "select":
      return (prop.select as { name?: string })?.name ?? "";
    case "status":
      return (prop.status as { name?: string })?.name ?? "";
    case "multi_select":
      return ((prop.multi_select as { name?: string }[]) ?? []).map((s) => s.name).join(", ");
    case "date": {
      const date = prop.date as NotionDateRange | null;
      return date?.start ? date.start + (date.end ? ` → ${date.end}` : "") : "";
    }
    case "checkbox":
      return prop.checkbox ? "☑" : "☐";
    case "people":
      return ((prop.people as { name?: string }[]) ?? []).map((p) => p.name ?? "user").join(", ");
    case "url":
      return (prop.url as string) ?? "";
    case "email":
      return (prop.email as string) ?? "";
    case "phone_number":
      return (prop.phone_number as string) ?? "";
    case "created_time":
      return (prop.created_time as string) ?? "";
    case "last_edited_time":
      return (prop.last_edited_time as string) ?? "";
    case "unique_id": {
      const uid = prop.unique_id as NotionUniqueId | null;
      return uid?.number != null ? `${uid.prefix ? `${uid.prefix}-` : ""}${uid.number}` : "";
    }
    case "formula": {
      const formula = prop.formula as RawProp;
      const v = formula?.type ? formula[formula.type] : undefined;
      return v == null ? "" : typeof v === "boolean" ? (v ? "☑" : "☐") : String(v);
    }
    case "relation": {
      const relations = (prop.relation as { id?: string }[]) ?? [];
      return relations.length ? `${relations.length} linked` : "";
    }
    case "rollup": {
      const rollup = prop.rollup as RawProp;
      const v = rollup?.type ? rollup[rollup.type] : undefined;
      return v == null ? "" : Array.isArray(v) ? `${v.length} item(s)` : String(v);
    }
    default:
      return "";
  }
}

function rowTitle(row: RawRow, titleColumn: string): string {
  return flattenValue(row.properties?.[titleColumn]) || "(untitled)";
}
interface DayComponents {
  year: number;
  month: number;
  day: number;
}
/** A row that carries a parseable calendar date — the kept subset after dropping undated rows. */
interface DatedRow {
  d: DayComponents;
  title: string;
}
function dayOf(dateStr: string): DayComponents | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

function viewToBlock(
  view: ResolvedView,
  rows: RawRow[],
  titleColumn: string,
  dbTitle: string,
  tabs: string[],
): ViewBlock {
  const cols = view.columns.length ? view.columns : [titleColumn];
  const otherCols = cols.filter((c) => c !== titleColumn);

  switch (view.type) {
    case "gallery":
      return {
        type: "gallery",
        name: dbTitle,
        views: tabs,
        cardSize: "medium",
        cards: rows.map((r) => ({
          name: rowTitle(r, titleColumn),
          lines: otherCols.map((c) => flattenValue(r.properties?.[c])).filter(Boolean),
        })),
      };
    case "board": {
      const groupBy = view.groupBy ?? otherCols[0] ?? titleColumn;
      const groups = new Map<string, GalleryCard[]>();
      // Seed EVERY group-by option first so empty columns still render, in the schema's option order —
      // Notion shows all columns; a board mockup that only draws the sampled groups is misleading.
      for (const option of view.groupOptions ?? []) {
        groups.set(option, []);
      }
      for (const r of rows) {
        const key = flattenValue(r.properties?.[groupBy]) || "(empty)";
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push({ name: rowTitle(r, titleColumn) });
      }
      return {
        type: "board",
        name: dbTitle,
        views: tabs,
        groups: [...groups].map(([name, cards]) => {
          if (cards.length <= BOARD_CARD_CAP) {
            return { name, cards };
          }
          // Keep the true count in the header; show a capped set plus a "+N more" tail card.
          return {
            name,
            total: cards.length,
            cards: [...cards.slice(0, BOARD_CARD_CAP), { name: `+${cards.length - BOARD_CARD_CAP} more` }],
          };
        }),
      };
    }
    case "list":
      return {
        type: "list",
        name: dbTitle,
        views: tabs,
        items: rows.map((r) => ({
          title: rowTitle(r, titleColumn),
          meta: otherCols
            .map((c) => flattenValue(r.properties?.[c]))
            .filter(Boolean)
            .join(" · "),
        })),
      };
    case "calendar": {
      const dateCol = view.dateProp ?? cols.find((c) => flattenValue(rows[0]?.properties?.[c]).match(/^\d{4}-\d{2}/));
      const dated = rows
        .map((r) => ({ d: dayOf(flattenValue(r.properties?.[dateCol ?? ""])), title: rowTitle(r, titleColumn) }))
        .filter((x): x is DatedRow => x.d !== null);
      if (dated.length === 0) {
        break; // no usable dates → fall through to table
      }
      const { year, month } = dated[0].d;
      return {
        type: "calendar",
        name: dbTitle,
        views: tabs,
        year,
        month,
        events: dated
          .filter((x) => x.d.year === year && x.d.month === month)
          .map((x) => ({ day: x.d.day, title: x.title })),
      };
    }
    default:
      break;
  }
  // table (and the fallback for timeline/chart/form/map/dashboard/unknown — render the rows as a table)
  return {
    type: "table",
    name: dbTitle,
    views: tabs,
    columns: cols,
    rows: rows.map((r) => cols.map((c) => flattenValue(r.properties?.[c]))),
  };
}

/** Map a database's resolved views + sample rows to a renderable DatabaseModel. Pure. */
export function databaseToModel(input: DbInput): DatabaseModel {
  return {
    title: input.title,
    icon: input.icon,
    view: 0,
    views: input.views.length
      ? (() => {
          const tabs = input.views.map((v) => v.name);
          return input.views.map((v) => viewToBlock(v, input.rows, input.titleColumn, input.title, tabs));
        })()
      : [
          {
            type: "table",
            name: input.title,
            columns: [input.titleColumn],
            rows: input.rows.map((r) => [rowTitle(r, input.titleColumn)]),
          },
        ],
  };
}

interface ViewConfigProperty {
  property_id?: string;
  property_name?: string;
  visible?: boolean;
}
interface ViewConfigShape {
  properties?: ViewConfigProperty[];
  group_by?: { property_id?: string };
  date_property_id?: string;
  date_property_name?: string;
}

/** Resolve a raw Notion view's config (property ids → names) into a ResolvedView the mapper consumes. */
export function resolveView(view: RawView, idToName: IdToName): ResolvedView {
  const config = (view.configuration ?? {}) as ViewConfigShape;
  const resolve = (id: string | undefined): string | undefined =>
    id ? (idToName[id] ?? idToName[decodePropertyId(id)]) : undefined;
  const columns = (config.properties ?? [])
    .filter((p) => p.visible !== false)
    .map((p) => resolve(p.property_id) ?? p.property_name)
    .filter((name): name is string => Boolean(name));
  return {
    name: view.name ?? "View",
    type: view.type ?? "table",
    columns,
    groupBy: resolve(config.group_by?.property_id),
    dateProp: resolve(config.date_property_id) ?? config.date_property_name,
  };
}

/** A board's columns are its group-by property's options — return them in schema order so the mockup
 * draws every status/select column (even empty ones), matching how Notion lays out the board. */
export function groupOptionsFor(groupBy: string | undefined, schema: PropertiesMap): string[] | undefined {
  if (!groupBy) {
    return undefined;
  }
  const property = schema[groupBy];
  const options = (property?.status?.options ?? property?.select?.options) as { name?: string }[] | undefined;
  const names = (options ?? []).map((option) => option.name).filter((name): name is string => Boolean(name));
  return names.length ? names : undefined;
}
