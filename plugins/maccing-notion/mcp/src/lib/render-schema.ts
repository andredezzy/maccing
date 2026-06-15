// Zod schemas for the render tools — the recursive Block union (children via z.lazy), the PageModel,
// and the standalone DatabaseModel. Shared by render_page / render_database / render_blocks so the
// wire schema (and its self-documentation) stays in one place.

import { z } from "zod";

const card = z.object({
  icon: z.string().optional().describe("emoji or gray named-icon name before the card name"),
  name: z.string(),
  lines: z.array(z.string()).optional().describe("metric/description lines under the name"),
});
const views = z.array(z.string()).optional().describe("view-tab names");

const tableBlock = z.object({
  type: z.literal("table"),
  name: z.string(),
  views,
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
const galleryBlock = z.object({
  type: z.literal("gallery"),
  name: z.string(),
  views,
  cardSize: z.enum(["small", "medium"]).optional(),
  cards: z.array(card),
});
const boardBlock = z.object({
  type: z.literal("board"),
  name: z.string(),
  views,
  groups: z.array(z.object({ name: z.string(), cards: z.array(card) })),
});
const listBlock = z.object({
  type: z.literal("list"),
  name: z.string(),
  views,
  items: z.array(z.object({ icon: z.string().optional(), title: z.string(), meta: z.string().optional() })),
});
const calendarBlock = z.object({
  type: z.literal("calendar"),
  name: z.string(),
  views,
  year: z.number(),
  month: z.number().describe("1-12"),
  events: z.array(z.object({ day: z.number(), title: z.string() })).optional(),
});
const timelineBlock = z.object({
  type: z.literal("timeline"),
  name: z.string(),
  views,
  axis: z.string().optional(),
  rows: z.array(z.object({ label: z.string(), start: z.number().describe("0-1"), end: z.number().describe("0-1") })),
});
const chartBlock = z.object({
  type: z.literal("chart"),
  name: z.string(),
  views,
  chartType: z.enum(["bar", "line", "donut", "number"]),
  data: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  value: z.string().optional().describe("for chartType 'number'"),
  unit: z.string().optional(),
});
const formBlock = z.object({
  type: z.literal("form"),
  name: z.string(),
  views,
  fields: z.array(z.object({ label: z.string(), fieldType: z.string().optional() })),
});
const mapBlock = z.object({ type: z.literal("map"), name: z.string(), views, pins: z.number().optional() });

// biome-ignore lint/suspicious/noExplicitAny: z.lazy recursion needs a loose annotation for children
export const blockSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("paragraph"), text: z.string().optional(), children: z.array(blockSchema).optional() }),
    z.object({ type: z.literal("heading"), text: z.string() }),
    z.object({
      type: z.enum(["heading_1", "heading_2", "heading_3"]),
      text: z.string(),
      toggle: z.boolean().optional(),
      children: z.array(blockSchema).optional(),
    }),
    z.object({ type: z.literal("bulleted_list_item"), text: z.string(), children: z.array(blockSchema).optional() }),
    z.object({ type: z.literal("numbered_list_item"), text: z.string(), children: z.array(blockSchema).optional() }),
    z.object({
      type: z.literal("to_do"),
      text: z.string(),
      checked: z.boolean().optional(),
      children: z.array(blockSchema).optional(),
    }),
    z.object({ type: z.literal("toggle"), text: z.string(), children: z.array(blockSchema).optional() }),
    z.object({ type: z.literal("quote"), text: z.string(), children: z.array(blockSchema).optional() }),
    z.object({
      type: z.literal("callout"),
      icon: z.string().optional(),
      lines: z.array(z.string()),
      children: z.array(blockSchema).optional(),
    }),
    z.object({ type: z.literal("divider") }),
    z.object({
      type: z.literal("code"),
      language: z.string().optional(),
      text: z.string(),
      caption: z.string().optional(),
    }),
    z.object({ type: z.literal("equation"), expression: z.string() }),
    z.object({
      type: z.enum(["image", "video", "audio", "file", "pdf"]),
      url: z.string().optional(),
      name: z.string().optional(),
      caption: z.string().optional(),
    }),
    z.object({ type: z.enum(["bookmark", "link_preview"]), url: z.string(), caption: z.string().optional() }),
    z.object({ type: z.literal("embed"), label: z.string() }),
    z.object({
      type: z.literal("column_list"),
      columns: z.array(z.object({ ratio: z.number().optional(), children: z.array(blockSchema) })),
    }),
    z.object({
      type: z.literal("simple_table"),
      rows: z.array(z.array(z.string())),
      hasColumnHeader: z.boolean().optional(),
      hasRowHeader: z.boolean().optional(),
    }),
    z.object({ type: z.literal("breadcrumb"), path: z.array(z.string()).optional() }),
    z.object({ type: z.literal("table_of_contents"), headings: z.array(z.string()).optional() }),
    z.object({
      type: z.literal("synced_block"),
      from: z.string().optional(),
      children: z.array(blockSchema).optional(),
    }),
    z.object({
      type: z.literal("page_link"),
      icon: z.string().optional(),
      title: z.string(),
      note: z.string().optional(),
    }),
    z.object({ type: z.literal("database"), database: z.lazy(() => databaseModelSchema) }),
    tableBlock,
    galleryBlock,
    boardBlock,
    listBlock,
    calendarBlock,
    timelineBlock,
    chartBlock,
    formBlock,
    mapBlock,
    z.object({
      type: z.literal("dashboard"),
      name: z.string(),
      views,
      widgets: z.array(z.object({ title: z.string(), view: blockSchema })),
    }),
    z.object({ type: z.literal("unsupported"), label: z.string().optional() }),
  ]),
);

const viewBlock = z.union([
  tableBlock,
  galleryBlock,
  boardBlock,
  listBlock,
  calendarBlock,
  timelineBlock,
  chartBlock,
  formBlock,
  mapBlock,
]);

export const pageModelSchema = z.object({
  title: z.string(),
  icon: z.string().optional().describe("emoji or gray named-icon name"),
  cover: z.string().optional().describe("short cover label; rendered as a ▒ band"),
  description: z.string().optional(),
  width: z.number().optional().describe("page columns (default 70)"),
  blocks: z.array(blockSchema),
});

export const databaseModelSchema = z.object({
  title: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  width: z.number().optional(),
  views: z.array(viewBlock),
  view: z
    .union([z.number(), z.literal("all")])
    .optional()
    .describe("view index, or 'all' to stack every view. Default 0."),
});
