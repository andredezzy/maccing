// render_page — turn a structured page_model into the canonical fixed-width ASCII "page mockup":
// a faithful visual of how a Notion page looks / WILL look (cover · icon · title · callouts · inline
// DBs as galleries/tables with view tabs + "+ New" · full-page-DB & sub-page links). The renderer owns
// all alignment (pads by display width, emoji-safe), so the caller supplies only structure — never
// counts a character. Use it to SHOW a proposed page's resulting shape before writing, and to render
// the live result after. See lib/render-mockup.ts for the model + renderer.

import { z } from "zod";
import { type PageModel, renderMockup } from "../lib/render-mockup";
import { err, ok, type ToolModule } from "../tool";

const card = z.object({
  icon: z.string().optional().describe("emoji or gray named-icon name shown before the card name"),
  name: z.string(),
  lines: z.array(z.string()).optional().describe("metric/description lines under the name"),
});

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("callout"), icon: z.string().optional(), lines: z.array(z.string()) }),
  z.object({ type: z.literal("heading"), text: z.string() }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("paragraph"), text: z.string().optional() }).describe("empty text = a spacer"),
  z.object({ type: z.literal("embed"), label: z.string() }),
  z.object({
    type: z.literal("gallery"),
    name: z.string(),
    views: z.array(z.string()).optional().describe("view-tab names, e.g. ['By muscle','All']"),
    cardSize: z.enum(["small", "medium"]).optional(),
    cards: z.array(card),
  }),
  z.object({
    type: z.literal("table"),
    name: z.string(),
    views: z.array(z.string()).optional(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  z.object({
    type: z.literal("page_link"),
    icon: z.string().optional(),
    title: z.string(),
    note: z.string().optional().describe("e.g. 'full-page database' or 'page'"),
  }),
]);

const pageModel = z.object({
  title: z.string(),
  icon: z.string().optional().describe("emoji or gray named-icon name"),
  cover: z.string().optional().describe("short cover label; rendered as a ▒ band"),
  description: z.string().optional(),
  width: z.number().optional().describe("page columns (default 70)"),
  blocks: z.array(block),
});

export const renderPage: ToolModule = {
  name: "render_page",
  config: {
    title: "Render a Notion page mockup",
    description:
      "Render a structured `page_model` into the canonical fixed-width ASCII PAGE MOCKUP — a faithful " +
      "picture of how a Notion page looks / WILL look. The renderer owns ALL alignment (pads by display " +
      "width, emoji-safe), so you supply only structure and never count characters — hand-typed mockups " +
      "drift, rendered ones never do. `page_model`: { title, icon?, cover?, description?, blocks[] } where " +
      "each block is one of: callout {icon?,lines[]} · heading {text} · divider · paragraph {text?} (empty=spacer) · " +
      "embed {label} · gallery {name,views?,cardSize?('small'|'medium'),cards[{icon?,name,lines?}]} · " +
      "table {name,views?,columns[],rows[][]} · page_link {icon?,title,note?}. Inline DBs are galleries or " +
      "tables; a full-page DB or sub-page is a page_link. Use this to SHOW a page's resulting shape in a " +
      "proposal (how it will become) and to render the live result after a write.",
    annotations: { title: "Render a Notion page mockup", readOnlyHint: true },
    inputSchema: { page_model: pageModel },
  },

  handler: async (args) => {
    try {
      const model = pageModel.parse(args.page_model) as PageModel;
      return ok(renderMockup(model));
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
