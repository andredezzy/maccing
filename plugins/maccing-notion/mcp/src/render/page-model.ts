// Live auto-mapper: a raw Notion page object + its fetched block tree → a PageModel that render_mockup
// can draw. PURE (no API calls) so it is unit-testable on synthetic payloads; the read_page tool does
// the fetching (recursive children) and hands the tree here. Unknown blocks degrade to `unsupported`.

import { iconGlyph, type NotionIcon } from "../readers/object";
import { type RichText, richTextToPlain } from "../readers/page";
import type { MockupBlock, PageModel } from "./model";

interface NotionFileSource {
  type?: string;
  external?: { url?: string };
  file?: { url?: string };
  name?: string;
  caption?: RichText[];
}
/** A raw Notion block with its children attached by the fetcher. */
export interface RawBlock {
  id?: string;
  type: string;
  has_children?: boolean;
  children?: RawBlock[];
  [key: string]: unknown;
}
interface RawPageProperty {
  type?: string;
  title?: RichText[];
}
export interface RawPage {
  icon?: NotionIcon | null;
  cover?: { type?: string } | null;
  properties?: Record<string, RawPageProperty>;
}

function caption(runs: unknown): string | undefined {
  return richTextToPlain(runs) || undefined;
}
function sourceUrl(media: NotionFileSource | undefined): string | undefined {
  if (!media) {
    return undefined;
  }
  return media.external?.url ?? media.file?.url ?? (media.type === "file_upload" ? "(uploaded)" : undefined);
}

const TEXT_TYPES = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "to_do",
  "toggle",
  "quote",
  "callout",
]);

function mapBlock(block: RawBlock): MockupBlock {
  const data = (block[block.type] ?? {}) as Record<string, unknown>;
  const text = TEXT_TYPES.has(block.type) ? richTextToPlain(data.rich_text) : "";
  const kids = block.children?.length ? mapBlocks(block.children) : undefined;

  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", text, children: kids };
    case "heading_1":
    case "heading_2":
    case "heading_3":
      return {
        type: block.type,
        text,
        toggle: Boolean(data.is_toggleable),
        children: data.is_toggleable ? kids : undefined,
      };
    case "bulleted_list_item":
      return { type: "bulleted_list_item", text, children: kids };
    case "numbered_list_item":
      return { type: "numbered_list_item", text, children: kids };
    case "to_do":
      return { type: "to_do", text, checked: Boolean(data.checked), children: kids };
    case "toggle":
      return { type: "toggle", text, children: kids };
    case "quote":
      return { type: "quote", text, children: kids };
    case "callout":
      return { type: "callout", icon: iconGlyph(data.icon as NotionIcon), lines: text.split("\n"), children: kids };
    case "divider":
      return { type: "divider" };
    case "code":
      return {
        type: "code",
        language: data.language as string,
        text: richTextToPlain(data.rich_text),
        caption: caption(data.caption),
      };
    case "equation":
      return { type: "equation", expression: (data.expression as string) ?? "" };
    case "image":
    case "video":
    case "audio":
    case "file":
    case "pdf": {
      const media = data as NotionFileSource;
      return { type: block.type, url: sourceUrl(media), name: media.name, caption: caption(media.caption) };
    }
    case "bookmark":
      return { type: "bookmark", url: (data.url as string) ?? "", caption: caption(data.caption) };
    case "link_preview":
      return { type: "link_preview", url: (data.url as string) ?? "" };
    case "embed":
      return { type: "embed", label: (data.url as string) ?? "embed" };
    case "column_list":
      return {
        type: "column_list",
        columns: (block.children ?? []).map((column) => ({ children: mapBlocks(column.children ?? []) })),
      };
    case "table":
      return {
        type: "simple_table",
        hasColumnHeader: Boolean(data.has_column_header),
        rows: (block.children ?? []).map((row) =>
          ((row.table_row as { cells?: RichText[][] })?.cells ?? []).map((cell) => richTextToPlain(cell)),
        ),
      };
    case "breadcrumb":
      return { type: "breadcrumb" };
    case "table_of_contents":
      return { type: "table_of_contents" };
    case "synced_block":
      return { type: "synced_block", children: kids };
    case "child_page":
      return { type: "page_link", title: (data.title as string) ?? "(page)", note: "page" };
    case "child_database":
      return { type: "page_link", icon: "▦", title: (data.title as string) ?? "(database)", note: "database" };
    case "link_to_page":
      return { type: "page_link", title: "(linked page)", note: "link" };
    default:
      return { type: "unsupported", label: block.type };
  }
}

function mapBlocks(blocks: RawBlock[]): MockupBlock[] {
  return blocks.map(mapBlock);
}

function pageTitle(page: RawPage): string {
  const titleProp = Object.values(page.properties ?? {}).find((property) => property.type === "title");
  return richTextToPlain(titleProp?.title) || "(untitled)";
}

/** Map a raw Notion page + its fetched block tree to a PageModel. Pure. */
export function pageToModel(page: RawPage, blocks: RawBlock[]): PageModel {
  return {
    title: pageTitle(page),
    icon: iconGlyph(page.icon),
    cover: page.cover ? "cover" : undefined,
    blocks: mapBlocks(blocks),
  };
}
