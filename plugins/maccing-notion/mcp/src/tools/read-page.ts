// Read any Notion page or database row in an agent-friendly format:
//   markdown — YAML frontmatter (properties, relations resolved to titles) + Notion-flavored Markdown body
//   outline  — compact block tree WITH block ids (for edit/audit), to a depth
//   text     — markdown with the markup stripped (pure reading / search)
// Page bodies come from the native /markdown endpoint (~22x smaller than raw block JSON), recovering
// unknown_block_ids to completion (no round cap; stops only when a round makes no further progress).

import { z } from "zod";
import { abbreviateId, normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import type { NotionChildBlock, NotionChildrenResponse } from "../readers/blocks";
import { type NotionMarkdownResponse, normalizeCallouts } from "../readers/markdown";
import type { NotionIcon } from "../readers/object";
import { flattenProperty, type NotionPageBase, titleOf } from "../readers/page";
import { resolveRelations } from "../readers/resolve-relations";
import { pageToModel, type RawBlock, type RawPage, renderPage } from "../render";
import { err, ok, type ToolModule } from "../tool";

const FORMATS = ["markdown", "outline", "text", "mockup"] as const;

interface RawChildrenResponse {
  results?: RawBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
}
/** Fetch a page's block tree (recursing into has_children blocks up to `depth`), for the mockup renderer. */
async function fetchBlockTree(id: string, depth: number): Promise<RawBlock[]> {
  const out: RawBlock[] = [];
  let cursor: string | undefined;
  do {
    const query: Record<string, unknown> = { page_size: 100 };
    if (cursor) {
      query.start_cursor = cursor;
    }
    const response = await publicRequest("GET", `/v1/blocks/${id}/children`, undefined, query);
    if (!response.ok) {
      break;
    }
    const body = response.body as RawChildrenResponse;
    for (const block of body.results ?? []) {
      if (block.has_children && depth > 0 && block.id) {
        block.children = await fetchBlockTree(block.id, depth - 1);
      }
      out.push(block);
    }
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

interface SubPageMarkdown {
  markdown: string;
  unknownBlockIds: string[];
}

interface PageObject extends NotionPageBase {
  icon?: NotionIcon | null;
}

interface FetchedBody {
  markdown: string;
  rounds: number;
  unfetchable: string[];
}

/** Page body as markdown, recovering unknown_block_ids until no round makes progress. */
async function fetchBody(pageId: string): Promise<FetchedBody> {
  const first = await publicRequest("GET", `/v1/pages/${pageId}/markdown`);
  if (!first.ok) {
    return { markdown: "(could not read this page as markdown)", rounds: 1, unfetchable: [] };
  }
  const firstPageBody = first.body as NotionMarkdownResponse;
  let body = firstPageBody.markdown ?? "";
  let pending = firstPageBody.unknown_block_ids ?? [];
  const seen = new Set<string>();
  let rounds = 1;

  while (pending.length > 0) {
    const unseenBlockIds = pending.filter((id) => !seen.has(id));
    if (unseenBlockIds.length === 0) {
      return { markdown: body, rounds, unfetchable: pending }; // no progress — genuinely unfetchable
    }
    for (const id of unseenBlockIds) {
      seen.add(id);
    }
    rounds++;
    const subPageResults = await Promise.all(
      unseenBlockIds.map(async (id): Promise<SubPageMarkdown> => {
        const response = await publicRequest("GET", `/v1/pages/${id}/markdown`);
        const subMarkdown = response.ok ? (response.body as NotionMarkdownResponse) : null;
        return { markdown: subMarkdown?.markdown ?? "", unknownBlockIds: subMarkdown?.unknown_block_ids ?? [] };
      }),
    );
    for (const subPageResult of subPageResults) {
      if (subPageResult.markdown) {
        body += `\n\n${subPageResult.markdown}`;
      }
    }
    pending = subPageResults.flatMap((subPageResult) => subPageResult.unknownBlockIds);
  }

  return { markdown: body, rounds, unfetchable: [] };
}

/**
 * Compact page-icon label for YAML frontmatter: the emoji, or a named icon's NAME only (no `·color`
 * suffix), or null to omit the line. Deliberately distinct from readers/object's `iconLabel`: this
 * suppresses external/file URL icons (a frontmatter URL is noise) and drops the color, keeping the
 * header terse. `describe` uses the verbose `iconLabel` instead.
 */
function pageIconLabel(page: PageObject): string | null {
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
  const properties = page.properties ?? {};
  const flattenedProperties = Object.entries(properties)
    .filter(([, property]) => property.type !== "title")
    .map(([name, property]) => [name, flattenProperty(property)] as const);

  const relationIds = flattenedProperties.flatMap(([, flattenedProperty]) => flattenedProperty.relationIds ?? []);
  const titles = relationIds.length > 0 ? await resolveRelations(relationIds) : new Map<string, string>();

  const lines = ["---", `title: ${titleOf(page)}`];
  const icon = pageIconLabel(page);
  if (icon) {
    lines.push(`icon: ${icon}`);
  }
  for (const [name, flattenedProperty] of flattenedProperties) {
    let rendered: string;
    if (flattenedProperty.relationIds) {
      rendered = flattenedProperty.relationIds.map((id) => titles.get(id) ?? abbreviateId(id)).join(", ");
    } else {
      rendered = flattenedProperty.value === null ? "" : String(flattenedProperty.value);
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

function blockPreview(block: NotionChildBlock): string {
  if (block.type === "child_page") {
    return `[page] ${block.child_page?.title ?? ""}`;
  }
  if (block.type === "child_database") {
    return `[db] ${block.child_database?.title ?? ""}`;
  }
  const blockContent = block[block.type] as { rich_text?: { plain_text?: string }[] } | undefined;
  const text = (blockContent?.rich_text ?? [])
    .map((segment) => segment.plain_text ?? "")
    .join("")
    .replace(/\n/g, " ");
  return text.slice(0, 60);
}

/** Compact block tree with ids, to `depth` (root fully paginated; recurse into has_children). */
async function buildOutline(pageId: string, depth: number): Promise<string> {
  const lines: string[] = [];
  let isDepthTruncated = false;

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
      const body = response.body as NotionChildrenResponse;
      for (const block of body.results ?? []) {
        const indent = "  ".repeat(level - 1);
        lines.push(`${indent}${block.type.padEnd(20)} [${abbreviateId(block.id)}]  "${blockPreview(block)}"`);
        if (block.has_children) {
          if (level < depth) {
            await walk(block.id, level + 1);
          } else {
            isDepthTruncated = true;
          }
        }
      }
      cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
    } while (cursor);
  };

  await walk(pageId, 1);
  const note = isDepthTruncated ? ` · deeper than depth ${depth} not shown` : "";
  return `${lines.join("\n")}\n# ${lines.length} blocks · depth ${depth}${note}`;
}

export const readPage: ToolModule = {
  name: "read_page",
  config: {
    title: "Read a Notion page/row",
    description:
      "Read any Notion page or database row in an agent-friendly format. format=markdown: " +
      "YAML frontmatter with the page's properties (relations resolved to titles, rollups/formulas as scalars) " +
      "followed by the Notion-flavored Markdown body — ~22x smaller than raw block JSON, fully recovered. " +
      "format=outline: a compact block tree WITH block ids (use this when you need a block id to edit). " +
      "format=text: the body with Markdown markup stripped. " +
      "format=mockup: render the LIVE page as the canonical fixed-width ASCII page mockup (the deterministic " +
      "render_mockup renderer applied to the live block tree) — the one-call way to SHOW how a page looks.",
    annotations: { title: "Read a Notion page/row", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      page_id: z.string().describe("The page or database-row id to read."),
      format: z.enum(FORMATS).describe("markdown | outline | text | mockup — required."),
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
    const pageId = normalizeUuid(String(args.page_id ?? ""));
    if (!UUID_PATTERN.test(pageId)) {
      return err("page_id must be a UUID.");
    }
    const format = String(args.format);
    if (!FORMATS.includes(format as (typeof FORMATS)[number])) {
      return err(`Invalid format "${String(args.format)}". One of: ${FORMATS.join(", ")}`);
    }

    try {
      if (format === "outline") {
        const depth = typeof args.depth === "number" && args.depth > 0 ? Math.min(args.depth, 5) : 2;
        return ok(await buildOutline(pageId, depth));
      }

      if (format === "mockup") {
        const depth = typeof args.depth === "number" && args.depth > 0 ? Math.min(args.depth, 5) : 3;
        const [pageResponse, tree] = await Promise.all([
          publicRequest("GET", `/v1/pages/${pageId}`),
          fetchBlockTree(pageId, depth),
        ]);
        if (!pageResponse.ok) {
          return err("Could not read the page — check the id and that NOTION_TOKEN has access.");
        }
        return ok(renderPage(pageToModel(pageResponse.body as RawPage, tree)));
      }

      const includeProperties = args.include_properties !== false;
      const [pageResponse, body] = await Promise.all([
        includeProperties ? publicRequest("GET", `/v1/pages/${pageId}`) : Promise.resolve(null),
        fetchBody(pageId),
      ]);

      const normalizedMarkdown = normalizeCallouts(body.markdown);
      const content = format === "text" ? toText(normalizedMarkdown) : normalizedMarkdown;

      const yamlFrontmatter =
        includeProperties && pageResponse?.ok ? `${await frontmatter(pageResponse.body as PageObject)}\n\n` : "";

      const completionNote =
        body.unfetchable.length > 0
          ? `\n\n[INCOMPLETE — ${body.unfetchable.length} block(s) unfetchable (permission/deleted); recovery made no further progress. ` +
            `Ids: ${body.unfetchable.map(abbreviateId).join(", ")} | rounds_used: ${body.rounds}]`
          : `\n\n[TRUNCATED: false | rounds_used: ${body.rounds}]`;

      return ok(`${yamlFrontmatter}${content}${completionNote}`);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
