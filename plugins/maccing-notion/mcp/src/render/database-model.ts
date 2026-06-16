// Live auto-mapper: a Notion database's (already id-resolved) views + sample rows → a DatabaseModel
// that render_mockup can draw. PURE (no API calls) so it is unit-testable; the read_database tool
// does the fetching; resolving a raw view + its rows into a renderable model is all pure and lives here.
// Unknown view types fall back to a table.

import { decodePropertyId } from "../notion/ids";
import { type NotionDateRange, richTextToPlain } from "../readers/page";
import type { PropertiesMap } from "../readers/schema";
import type { IdToName, RawView } from "../readers/views";
import type { GalleryCard } from "./blocks/cards";
import type { DatabaseModel, ViewBlock } from "./blocks/database";

/** A raw Notion property value (one entry of a page's `properties`). */
interface RawProperty {
  type?: string;
  [key: string]: unknown;
}
export interface RawRow {
  properties?: Record<string, RawProperty>;
}
interface NotionUniqueId {
  prefix?: string;
  number?: number;
}
/** A view with its property IDs already resolved to names by the caller. */
interface ResolvedView {
  name: string;
  type: string;
  columns: string[]; // visible column NAMES (title first)
  groupBy?: string; // board group-by column name
  groupOptions?: string[]; // board: every group-by option name, in order (seeds empty columns too)
  dateProperty?: string; // calendar/timeline date column name
}

/** A dominant board column would tower over its siblings — cap the visible cards, keep the true count. */
const BOARD_CARD_CAP = 6;
interface DatabaseModelInput {
  title: string;
  icon?: string;
  titleColumn: string;
  views: ResolvedView[];
  rows: RawRow[];
}

/** A Notion date range → "start" or "start → end" (empty when undated). */
function formatDateRange(date: NotionDateRange | null | undefined): string {
  return date?.start ? date.start + (date.end ? ` → ${date.end}` : "") : "";
}

/** Flatten a Notion property value to a compact display string. */
export function flattenValue(property: RawProperty | undefined): string {
  if (!property) {
    return "";
  }
  switch (property.type) {
    case "title":
    case "rich_text":
      return richTextToPlain(property[property.type]);
    case "number":
      return property.number == null ? "" : String(property.number);
    case "select":
      return (property.select as { name?: string })?.name ?? "";
    case "status":
      return (property.status as { name?: string })?.name ?? "";
    case "multi_select":
      return ((property.multi_select as { name?: string }[]) ?? []).map((option) => option.name).join(", ");
    case "date":
      return formatDateRange(property.date as NotionDateRange | null);
    case "checkbox":
      return property.checkbox ? "☑" : "☐";
    case "people":
      return ((property.people as { name?: string }[]) ?? []).map((person) => person.name ?? "user").join(", ");
    case "url":
      return (property.url as string) ?? "";
    case "email":
      return (property.email as string) ?? "";
    case "phone_number":
      return (property.phone_number as string) ?? "";
    case "created_time":
      return (property.created_time as string) ?? "";
    case "last_edited_time":
      return (property.last_edited_time as string) ?? "";
    case "unique_id": {
      const uniqueId = property.unique_id as NotionUniqueId | null;
      return uniqueId?.number != null ? `${uniqueId.prefix ? `${uniqueId.prefix}-` : ""}${uniqueId.number}` : "";
    }
    case "formula": {
      const formula = property.formula as RawProperty;
      const value = formula?.type ? formula[formula.type] : undefined;
      if (value == null) {
        return "";
      }
      if (typeof value === "boolean") {
        return value ? "☑" : "☐";
      }
      return formula.type === "date" ? formatDateRange(value as NotionDateRange) : String(value);
    }
    case "relation": {
      const relations = (property.relation as { id?: string }[]) ?? [];
      return relations.length ? `${relations.length} linked` : "";
    }
    case "rollup": {
      const rollup = property.rollup as RawProperty;
      const value = rollup?.type ? rollup[rollup.type] : undefined;
      return value == null ? "" : Array.isArray(value) ? `${value.length} item(s)` : String(value);
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
  date: DayComponents;
  title: string;
}

function dayOf(dateString: string): DayComponents | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
}

function viewToBlock(
  view: ResolvedView,
  rows: RawRow[],
  titleColumn: string,
  dbTitle: string,
  tabs: string[],
): ViewBlock {
  const columns = view.columns.length ? view.columns : [titleColumn];
  const otherColumns = columns.filter((column) => column !== titleColumn);

  switch (view.type) {
    case "gallery":
      return {
        type: "gallery",
        name: dbTitle,
        views: tabs,
        cardSize: "medium",
        cards: rows.map((row) => ({
          name: rowTitle(row, titleColumn),
          lines: otherColumns.map((column) => flattenValue(row.properties?.[column])).filter(Boolean),
        })),
      };
    case "board": {
      const groupBy = view.groupBy ?? otherColumns[0] ?? titleColumn;
      const groups = new Map<string, GalleryCard[]>();

      // Seed EVERY group-by option first so empty columns still render, in the schema's option order —
      // Notion shows all columns; a board mockup that only draws the sampled groups is misleading.
      for (const option of view.groupOptions ?? []) {
        groups.set(option, []);
      }
      for (const row of rows) {
        const key = flattenValue(row.properties?.[groupBy]) || "(empty)";
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push({ name: rowTitle(row, titleColumn) });
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
        items: rows.map((row) => ({
          title: rowTitle(row, titleColumn),
          meta: otherColumns
            .map((column) => flattenValue(row.properties?.[column]))
            .filter(Boolean)
            .join(" · "),
        })),
      };
    case "calendar": {
      const dateColumn =
        view.dateProperty ??
        columns.find((column) => flattenValue(rows[0]?.properties?.[column]).match(/^\d{4}-\d{2}/));
      const dated = rows
        .map((row) => ({
          date: dayOf(flattenValue(row.properties?.[dateColumn ?? ""])),
          title: rowTitle(row, titleColumn),
        }))
        .filter((datedRow): datedRow is DatedRow => datedRow.date !== null);
      if (dated.length === 0) {
        break; // no usable dates → fall through to table
      }
      const { year, month } = dated[0].date;
      return {
        type: "calendar",
        name: dbTitle,
        views: tabs,
        year,
        month,
        events: dated
          .filter((datedRow) => datedRow.date.year === year && datedRow.date.month === month)
          .map((datedRow) => ({ day: datedRow.date.day, title: datedRow.title })),
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
    columns: columns,
    rows: rows.map((row) => columns.map((column) => flattenValue(row.properties?.[column]))),
  };
}

/** Map a database's resolved views + sample rows to a renderable DatabaseModel. Pure. */
export function databaseToModel(input: DatabaseModelInput): DatabaseModel {
  const tabs = input.views.map((view) => view.name); // every view's tab bar lists all sibling names
  const views: ViewBlock[] = input.views.length
    ? input.views.map((view) => viewToBlock(view, input.rows, input.titleColumn, input.title, tabs))
    : [
        {
          type: "table",
          name: input.title,
          columns: [input.titleColumn],
          rows: input.rows.map((row) => [rowTitle(row, input.titleColumn)]),
        },
      ];
  return { title: input.title, icon: input.icon, view: 0, views };
}

interface ViewConfigProperty {
  property_id?: string;
  property_name?: string;
  visible?: boolean;
}
interface ViewConfig {
  properties?: ViewConfigProperty[];
  group_by?: { property_id?: string };
  date_property_id?: string;
  date_property_name?: string;
}

/** Resolve a raw Notion view's config (property ids → names) into a ResolvedView the mapper consumes. */
export function resolveView(view: RawView, idToName: IdToName): ResolvedView {
  const config = (view.configuration ?? {}) as ViewConfig;
  const resolve = (id: string | undefined): string | undefined =>
    id ? (idToName[id] ?? idToName[decodePropertyId(id)]) : undefined;
  const columns = (config.properties ?? [])
    .filter((viewProperty) => viewProperty.visible !== false)
    .map((viewProperty) => resolve(viewProperty.property_id) ?? viewProperty.property_name)
    .filter((name): name is string => Boolean(name));
  return {
    name: view.name ?? "View",
    type: view.type ?? "table",
    columns,
    groupBy: resolve(config.group_by?.property_id),
    dateProperty: resolve(config.date_property_id) ?? config.date_property_name,
  };
}

/** A board's columns are its group-by property's options — return them in schema order so the mockup
 * draws every status/select column (even empty ones), matching how Notion lays out the board. */
export function groupOptionsFor(groupBy: string | undefined, schema: PropertiesMap): string[] | undefined {
  if (!groupBy) {
    return undefined;
  }
  const property = schema[groupBy];
  const options = property?.status?.options ?? property?.select?.options;
  const names = (options ?? []).map((option) => option.name).filter((name): name is string => Boolean(name));
  return names.length ? names : undefined;
}
