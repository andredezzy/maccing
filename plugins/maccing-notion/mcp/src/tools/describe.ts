// Describe any Notion object's STRUCTURE/metadata (not its content). For a data source / database:
// its column schema (name · type · detail, formula bodies elided) + title/icon/parent + each
// column's icon (best-effort private). For a page / row: its icon, cover, title, parent, and its
// properties as name · type. Complements read_page (content+values) and read_database (rows+views).

import { z } from "zod";

import { iconLabel, type NotionIcon } from "../lib/format-object";
import { formatSchema, type PropertiesMap } from "../lib/format-schema";
import { readCollectionIcons } from "../lib/notion-private";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { err, ok, type ToolModule } from "../tool";

const UUID = /^[0-9a-f-]{32,36}$/i;

interface RichText {
  plain_text?: string;
}

interface ParentRef {
  type?: string;
  page_id?: string;
  data_source_id?: string;
  database_id?: string;
  block_id?: string;
}

interface DataSourceObject {
  title?: RichText[];
  icon?: NotionIcon | null;
  parent?: ParentRef;
  properties?: PropertiesMap;
}

interface DatabaseObject {
  data_sources?: { id: string }[];
}

interface PageProperty {
  type?: string;
  title?: RichText[];
}

interface PageObject {
  id?: string;
  icon?: NotionIcon | null;
  cover?: NotionIcon | null;
  parent?: ParentRef;
  properties?: Record<string, PageProperty>;
}

const short = (id: string): string => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);
const plain = (rich: RichText[] | undefined): string => (rich ?? []).map((part) => part.plain_text ?? "").join("");

function parentLabel(parent: ParentRef | undefined): string {
  if (!parent) {
    return "—";
  }
  switch (parent.type) {
    case "page_id":
      return parent.page_id ? `page ${short(parent.page_id)}` : "page";
    case "data_source_id":
      return parent.data_source_id ? `data_source ${short(parent.data_source_id)}` : "data_source";
    case "database_id":
      return parent.database_id ? `database ${short(parent.database_id)}` : "database";
    case "block_id":
      return parent.block_id ? `block ${short(parent.block_id)}` : "block";
    default:
      return parent.type ?? "—";
  }
}

/** Render a data source: metadata header + the column schema, enriched with best-effort column icons. */
async function describeDataSource(dataSourceId: string, body: DataSourceObject, note = ""): Promise<string> {
  const read = await readCollectionIcons([dataSourceId]);
  const icons = read.status === "ok" ? (read.byCollection[dataSourceId] ?? {}) : {};

  const header = [
    `# Data source: ${plain(body.title) || "(untitled)"}${note ? ` ${note}` : ""}`,
    `id: ${dataSourceId}`,
    `icon: ${iconLabel(body.icon)}`,
    `parent: ${parentLabel(body.parent)}`,
  ].join("\n");

  const throttled = read.status === "throttled" ? "\n\n(column icons unavailable — private read throttled; retry)" : "";
  return `${header}\n\n${formatSchema(body.properties ?? {}, icons)}${throttled}`;
}

/** Render a page/row: metadata header (icon/cover both PUBLIC) + its properties as name · type. */
function describePage(page: PageObject): string {
  const properties = page.properties ?? {};
  const names = Object.keys(properties);
  const titleName = names.find((name) => properties[name].type === "title");
  const title = titleName ? plain(properties[titleName].title) : "";

  const header = [
    `# Page: ${title || (page.id ? short(page.id) : "?")}`,
    `icon: ${iconLabel(page.icon)}`,
    `cover: ${iconLabel(page.cover)}`,
    `parent: ${parentLabel(page.parent)}`,
  ].join("\n");

  if (names.length === 0) {
    return `${header}\n\n# Properties (0)`;
  }

  const pad = Math.max(...names.map((name) => name.length)) + 2;
  const lines = names.map((name) => `${name.padEnd(pad)}${properties[name].type ?? "?"}`);
  return `${header}\n\n# Properties (${names.length})\n\n${lines.join("\n")}`;
}

export const describe: ToolModule = {
  name: "describe",
  config: {
    title: "Describe a Notion object's structure",
    description:
      "Describe any Notion object's STRUCTURE/metadata (not its content) — accepts any id: page, database " +
      "row, database, or data_source. For a data source/database: its column schema (name · type · detail, " +
      "formula bodies elided) + title, icon, parent, AND each column's icon (best-effort via the private API " +
      "when NOTION_TOKEN_V2 is configured; silently omitted otherwise — column icons are invisible to the " +
      "public API). For a page/row: its icon, cover (both public), title, parent, and its properties as " +
      "name · type. Complements read_page (content + values) and read_database (rows + views).",
    annotations: { title: "Describe a Notion object's structure", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      id: z.string().describe("Any target id — page, database row, database, or data_source."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const id = String(args.id ?? "").trim();
    if (!UUID.test(id)) {
      return err("id must be a UUID (page, database, or data_source).");
    }

    try {
      const dataSource = await publicRequest("GET", `/v1/data_sources/${id}`);
      if (dataSource.ok) {
        return ok(await describeDataSource(id, dataSource.body as DataSourceObject));
      }

      const database = await publicRequest("GET", `/v1/databases/${id}`);
      if (database.ok) {
        const dataSourceId = (database.body as DatabaseObject).data_sources?.[0]?.id;
        if (dataSourceId) {
          const inner = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
          if (inner.ok) {
            return ok(
              await describeDataSource(dataSourceId, inner.body as DataSourceObject, `(via database ${short(id)})`),
            );
          }
        }
      }

      const page = await publicRequest("GET", `/v1/pages/${id}`);
      if (page.ok) {
        return ok(describePage(page.body as PageObject));
      }

      return err(
        `Could not describe ${id} — not a readable page, database, or data source (check the id and that NOTION_TOKEN has access).`,
      );
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
