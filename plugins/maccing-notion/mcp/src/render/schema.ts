// Zod schemas for render_mockup — the internal DatabaseView schema (viewSchema) for the `database` block,
// the block schema (blockSchema) for the render_mockup tool input, and mockupSchema as the tool's full
// input union.
//
// The `database` block schema accepts the old simplified DatabaseModel shape so inline database mockups
// (with pre-built views[]) still work. Content blocks (paragraph, callout, etc.) accept the official
// Notion API shapes — `render_mockup` now takes official block JSON.

import { z } from "zod";
import type { DatabaseView } from "./blocks/engine";

// ── View object schemas (used by viewSchema AND by databaseModelSchema.views) ──────────────────────

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
  groups: z.array(z.object({ name: z.string(), cards: z.array(card), total: z.number().optional() })),
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
  month: z.number().min(1).max(12).describe("1-12"),
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
const feedBlock = z.object({
  type: z.literal("feed"),
  name: z.string(),
  views,
  posts: z.array(
    z.object({
      icon: z.string().optional(),
      title: z.string(),
      preview: z.string().optional(),
      meta: z.string().optional(),
    }),
  ),
});

// The view union is recursive because DashboardBlock.widgets[].view is a DatabaseView.
export const viewSchema: z.ZodType<DatabaseView> = z.lazy(() =>
  z.union([
    tableBlock,
    galleryBlock,
    boardBlock,
    listBlock,
    calendarBlock,
    timelineBlock,
    chartBlock,
    formBlock,
    mapBlock,
    feedBlock,
    z.object({
      type: z.literal("dashboard"),
      name: z.string(),
      views,
      widgets: z.array(z.object({ title: z.string(), view: viewSchema })),
    }),
  ]),
);

// ── Database block schema (the inline `database` block with pre-built views) ─────────────────────

const databaseModelSchema = z.object({
  title: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  width: z.number().optional(),
  views: z.array(viewSchema),
  view: z
    .union([z.number(), z.literal("all")])
    .optional()
    .describe("view index, or 'all' to stack every view. Default 0."),
});

const databaseBlockSchema = z.object({
  type: z.literal("database"),
  database: databaseModelSchema,
});

// ── Official block schema (accepts official Notion API block shapes) ──────────────────────────────

// A rich-text object as returned by the Notion API (only plain_text is required for rendering).
const richTextObject = z.object({ plain_text: z.string().optional() }).passthrough();
const richTextArray = z.array(richTextObject);

// An icon as returned by the Notion API.
const iconObject = z
  .object({
    type: z.string().optional(),
    emoji: z.string().optional(),
    icon: z.object({ name: z.string().optional() }).passthrough().optional(),
  })
  .passthrough()
  .nullable()
  .optional();

// The official Notion block — a discriminated union on `type` with a same-named payload. We accept
// any block whose type is one we know about (plus any unknown type that passes through passthrough).
export const blockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    // Content blocks
    z
      .object({ type: z.literal("paragraph"), paragraph: z.object({ rich_text: richTextArray }).passthrough() })
      .passthrough(),
    z
      .object({ type: z.literal("heading_1"), heading_1: z.object({ rich_text: richTextArray }).passthrough() })
      .passthrough(),
    z
      .object({ type: z.literal("heading_2"), heading_2: z.object({ rich_text: richTextArray }).passthrough() })
      .passthrough(),
    z
      .object({ type: z.literal("heading_3"), heading_3: z.object({ rich_text: richTextArray }).passthrough() })
      .passthrough(),
    z
      .object({ type: z.literal("heading_4"), heading_4: z.object({ rich_text: richTextArray }).passthrough() })
      .passthrough(),
    z
      .object({
        type: z.literal("bulleted_list_item"),
        bulleted_list_item: z.object({ rich_text: richTextArray }).passthrough(),
      })
      .passthrough(),
    z
      .object({
        type: z.literal("numbered_list_item"),
        numbered_list_item: z.object({ rich_text: richTextArray }).passthrough(),
      })
      .passthrough(),
    z.object({ type: z.literal("to_do"), to_do: z.object({ rich_text: richTextArray }).passthrough() }).passthrough(),
    z.object({ type: z.literal("toggle"), toggle: z.object({ rich_text: richTextArray }).passthrough() }).passthrough(),
    z.object({ type: z.literal("quote"), quote: z.object({ rich_text: richTextArray }).passthrough() }).passthrough(),
    z
      .object({
        type: z.literal("callout"),
        callout: z.object({ rich_text: richTextArray, icon: iconObject }).passthrough(),
      })
      .passthrough(),
    z.object({ type: z.literal("divider"), divider: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("code"), code: z.object({ rich_text: richTextArray }).passthrough() }).passthrough(),
    z.object({ type: z.literal("equation"), equation: z.object({ expression: z.string() }) }).passthrough(),
    // Media blocks
    z.object({ type: z.literal("image") }).passthrough(),
    z.object({ type: z.literal("video") }).passthrough(),
    z.object({ type: z.literal("audio") }).passthrough(),
    z.object({ type: z.literal("file") }).passthrough(),
    z.object({ type: z.literal("pdf") }).passthrough(),
    z.object({ type: z.literal("bookmark"), bookmark: z.object({ url: z.string() }).passthrough() }).passthrough(),
    z
      .object({ type: z.literal("link_preview"), link_preview: z.object({ url: z.string() }).passthrough() })
      .passthrough(),
    z.object({ type: z.literal("embed"), embed: z.object({ url: z.string() }).passthrough() }).passthrough(),
    // Structural blocks
    z.object({ type: z.literal("column_list"), column_list: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("table"), table: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("table_row"), table_row: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("breadcrumb"), breadcrumb: z.record(z.string(), z.unknown()) }).passthrough(),
    z
      .object({ type: z.literal("table_of_contents"), table_of_contents: z.record(z.string(), z.unknown()) })
      .passthrough(),
    z.object({ type: z.literal("synced_block"), synced_block: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("child_page"), child_page: z.object({ title: z.string() }) }).passthrough(),
    z.object({ type: z.literal("child_database"), child_database: z.object({ title: z.string() }) }).passthrough(),
    z.object({ type: z.literal("link_to_page"), link_to_page: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("template"), template: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("tab"), tab: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("meeting_notes"), meeting_notes: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("transcription"), transcription: z.record(z.string(), z.unknown()) }).passthrough(),
    z.object({ type: z.literal("unsupported") }).passthrough(),
    // Internal database block (inline mockup with pre-built views)
    databaseBlockSchema,
  ]),
);

// ── Page schema ───────────────────────────────────────────────────────────────────────────────────

// Official PageRender shape: { page: PageObject, blocks: BlockObject[] }
export const pageSchema = z.object({
  page: z
    .object({
      icon: iconObject,
      cover: z.record(z.string(), z.unknown()).nullable().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
  blocks: z.array(blockSchema),
});

// ── Mockup schema (the render_mockup tool's full input) ───────────────────────────────────────────

// A PageRender, a single Block (official API shape), or an array of Blocks.
// The `database` block is included in blockSchema above for inline database mockups.
export const mockupSchema = z.union([pageSchema, blockSchema, z.array(blockSchema)]);
