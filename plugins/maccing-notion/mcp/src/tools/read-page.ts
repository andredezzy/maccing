// Read any Notion page or database row in an agent-friendly format:
//   markdown — YAML frontmatter (properties, relations resolved to titles) + Notion-flavored Markdown body
//   outline  — compact block tree WITH block ids (for edit/audit), to a depth
//   text     — markdown with the markup stripped (pure reading / search)
// Page bodies come from the native /markdown endpoint (~22x smaller than raw block JSON), recovering
// unknown_block_ids to completion (no round cap; stops only when a round makes no further progress).

import { z } from "zod";

import { normalizeCallouts } from "../lib/notion-markdown";
import { flattenProperty, type PageWithProps, type RawProperty, titleOf } from "../lib/notion-page";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { resolveRelations } from "../lib/resolve-relations";
import { err, ok, type ToolModule } from "../tool";

const UUID = /^[0-9a-f-]{32,36}$/i;
const FORMATS = ["markdown", "outline", "text"] as const;

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-5)}`;

interface MarkdownResponse {
  markdown?: string;
  unknown_block_ids?: string[];
}

interface PageObject extends PageWithProps {
  icon?: { type?: string; emoji?: string; icon?: { name?: string } } | null;
}

/** Page body as markdown, recovering unknown_block_ids until no round makes progress. */
async function fetchBody(pageId: string): Promise<{ markdown: string; rounds: number; unfetchable: string[] }> {
  const first = await publicRequest("GET", `/v1/pages/${pageId}/markdown`);
  if (!first.ok) {
    return { markdown: "(could not read this page as markdown)", rounds: 1, unfetchable: [] };
  }
  const head = first.body as MarkdownResponse;
  let body = head.markdown ?? "";
  let pending = head.unknown_block_ids ?? [];
  const seen = new Set<string>();
  let rounds = 1;

  while (pending.length > 0) {
    const fresh = pending.filter((id) => !seen.has(id));
    if (fresh.length === 0) {
      return { markdown: body, rounds, unfetchable: pending }; // no progress — genuinely unfetchable
    }
    for (const id of fresh) {
      seen.add(id);
    }
    rounds++;
    const recovered = await Promise.all(
      fresh.map(async (id) => {
        const response = await publicRequest("GET", `/v1/pages/${id}/markdown`);
        const sub = response.ok ? (response.body as MarkdownResponse) : {};
        return { markdown: sub.markdown ?? "", unknown: sub.unknown_block_ids ?? [] };
      }),
    );
    for (const sub of recovered) {
      if (sub.markdown) {
        body += `\n\n${sub.markdown}`;
      }
    }
    pending = recovered.flatMap((sub) => sub.unknown);
  }

  return { markdown: body, rounds, unfetchable: [] };
}

function iconString(page: PageObject): string | null {
  const icon = page.icon;
  if (!icon) {
    return null;
  }
  if (icon.type === "emoji") {
    return icon.emoji ?? null;
  }
  if (icon.type === "icon") {
    return icon.icon?.name ?? null;
  }
  return null;
}

/** YAML frontmatter from page properties; relations rendered as titles. */
async function frontmatter(page: PageObject): Promise<string> {
  const props = page.properties ?? {};
  const flats = Object.entries(props)
    .filter(([, prop]) => (prop as RawProperty).type !== "title")
    .map(([name, prop]) => [name, flattenProperty(prop as RawProperty)] as const);

  const relationIds = flats.flatMap(([, flat]) => flat.relationIds ?? []);
  const titles = relationIds.length > 0 ? await resolveRelations(relationIds) : new Map<string, string>();

  const lines = ["---", `title: ${titleOf(page)}`];
  const icon = iconString(page);
  if (icon) {
    lines.push(`icon: ${icon}`);
  }
  for (const [name, flat] of flats) {
    let rendered: string;
    if (flat.relationIds) {
      rendered = flat.relationIds.map((id) => titles.get(id) ?? short(id)).join(", ");
    } else {
      rendered = flat.value === null ? "" : String(flat.value);
    }
    if (rendered !== "") {
      lines.push(`${name}: ${rendered}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/** Strip Markdown markup to plain text. */
function toText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, "").replace(/```/g, "")) // keep code body, drop fences
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ChildBlock {
  id: string;
  type: string;
  has_children?: boolean;
  child_page?: { title?: string };
  child_database?: { title?: string };
  [key: string]: unknown;
}

interface ChildrenResponse {
  results?: ChildBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
}

function blockPreview(block: ChildBlock): string {
  if (block.type === "child_page") {
    return `[page] ${block.child_page?.title ?? ""}`;
  }
  if (block.type === "child_database") {
    return `[db] ${block.child_database?.title ?? ""}`;
  }
  const payload = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
  const text = (payload?.rich_text ?? [])
    .map((t) => t.plain_text ?? "")
    .join("")
    .replace(/\n/g, " ");
  return text.slice(0, 60);
}

/** Compact block tree with ids, to `depth` (root fully paginated; recurse into has_children). */
async function buildOutline(pageId: string, depth: number): Promise<string> {
  const lines: string[] = [];
  let truncated = false;

  const walk = async (id: string, level: number): Promise<void> => {
    let cursor: string | undefined;
    do {
      const query: Record<string, unknown> = { page_size: 100 };
      if (cursor) {
        query.start_cursor = cursor;
      }
      const response = await publicRequest("GET", `/v1/blocks/${id}/children`, undefined, query);
      if (!response.ok) {
        return;
      }
      const body = response.body as ChildrenResponse;
      for (const block of body.results ?? []) {
        const indent = "  ".repeat(level - 1);
        lines.push(`${indent}${block.type.padEnd(20)} [${short(block.id)}]  "${blockPreview(block)}"`);
        if (block.has_children) {
          if (level < depth) {
            await walk(block.id, level + 1);
          } else {
            truncated = true;
          }
        }
      }
      cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
    } while (cursor);
  };

  await walk(pageId, 1);
  const note = truncated ? ` · deeper than depth ${depth} not shown` : "";
  return `${lines.join("\n")}\n# ${lines.length} blocks · depth ${depth}${note}`;
}

export const readPage: ToolModule = {
  name: "read_page",
  config: {
    title: "Read a Notion page/row",
    description:
      "Read any Notion page or database row in an agent-friendly format. format=markdown (default-style): " +
      "YAML frontmatter with the page's properties (relations resolved to titles, rollups/formulas as scalars) " +
      "followed by the Notion-flavored Markdown body — ~22x smaller than raw block JSON, fully recovered. " +
      "format=outline: a compact block tree WITH block ids (use this when you need a block id to edit). " +
      "format=text: the body with Markdown markup stripped.",
    annotations: { title: "Read a Notion page/row", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      page_id: z.string().describe("The page or database-row id to read."),
      format: z.enum(FORMATS).describe("markdown | outline | text — required."),
      include_properties: z
        .boolean()
        .optional()
        .describe("markdown only: prepend YAML frontmatter of properties (default true)."),
      depth: z.number().optional().describe("outline only: block-nesting levels to include (default 2)."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const pageId = String(args.page_id ?? "").trim();
    if (!UUID.test(pageId)) {
      return err("page_id must be a UUID.");
    }
    const format = String(args.format) as (typeof FORMATS)[number];
    if (!FORMATS.includes(format)) {
      return err(`Invalid format "${String(args.format)}". One of: ${FORMATS.join(", ")}`);
    }

    try {
      if (format === "outline") {
        const depth = typeof args.depth === "number" && args.depth > 0 ? Math.min(args.depth, 5) : 2;
        return ok(await buildOutline(pageId, depth));
      }

      const includeProps = args.include_properties !== false;
      const [pageResponse, body] = await Promise.all([
        includeProps ? publicRequest("GET", `/v1/pages/${pageId}`) : Promise.resolve(null),
        fetchBody(pageId),
      ]);

      const cleaned = normalizeCallouts(body.markdown);
      const content = format === "text" ? toText(cleaned) : cleaned;

      const head = includeProps && pageResponse?.ok ? `${await frontmatter(pageResponse.body as PageObject)}\n\n` : "";

      const trailer =
        body.unfetchable.length > 0
          ? `\n\n[INCOMPLETE — ${body.unfetchable.length} block(s) unfetchable (permission/deleted); recovery made no further progress. ` +
            `Ids: ${body.unfetchable.map(short).join(", ")} | rounds_used: ${body.rounds}]`
          : `\n\n[TRUNCATED: false | rounds_used: ${body.rounds}]`;

      return ok(`${head}${content}${trailer}`);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
