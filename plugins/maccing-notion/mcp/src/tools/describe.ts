// Describe any Notion object's STRUCTURE/metadata (not its content). For a data source / database:
// its column schema (name · type · detail, formula bodies elided) + title/icon/parent + each
// column's icon (best-effort private). For a page / row: its icon, cover, title, parent, and its
// properties as name · type. Complements read_page (content+values) and read_database (rows+views).

import { z } from "zod";
import { abbreviateId, normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { ReadStatus, readCollectionIcons } from "../notion/private-client";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { iconLabel, type NotionIcon } from "../readers/object";
import { type RichText, richTextToPlain } from "../readers/page";
import { type NotionParentRef, parentLabel } from "../readers/parent";
import { type DataSourceBody, formatSchema, type PropertiesMap } from "../readers/schema";
import { err, ok, type ToolModule } from "../tool";

interface DataSourceObject {
  title?: RichText[];
  icon?: NotionIcon | null;
  parent?: NotionParentRef;
  properties?: PropertiesMap;
}

interface PageProperty {
  type?: string;
  title?: RichText[];
}

interface PageObject {
  id?: string;
  icon?: NotionIcon | null;
  cover?: NotionIcon | null;
  parent?: NotionParentRef;
  properties?: Record<string, PageProperty>;
}

/** Render a data source: metadata header + the column schema, enriched with best-effort column icons. */
async function describeDataSource(dataSourceId: string, dataSource: DataSourceObject, note = ""): Promise<string> {
  const iconRead = await readCollectionIcons([dataSourceId]);
  const icons = iconRead.status === ReadStatus.OK ? (iconRead.byCollection[dataSourceId] ?? {}) : {};

  const header = [
    `# Data source: ${richTextToPlain(dataSource.title) || "(untitled)"}${note ? ` ${note}` : ""}`,
    `id: ${dataSourceId}`,
    `icon: ${iconLabel(dataSource.icon)}`,
    `parent: ${parentLabel(dataSource.parent)}`,
  ].join("\n");

  const throttled =
    iconRead.status === ReadStatus.THROTTLED ? "\n\n(column icons unavailable — private read throttled; retry)" : "";
  return `${header}\n\n${formatSchema(dataSource.properties ?? {}, icons)}${throttled}`;
}

/** Render a page/row: metadata header (icon/cover both PUBLIC) + its properties as name · type. */
function describePage(page: PageObject): string {
  const properties = page.properties ?? {};
  const names = Object.keys(properties);
  const titleName = names.find((name) => properties[name].type === "title");
  const title = titleName ? richTextToPlain(properties[titleName].title) : "";

  const header = [
    `# Page: ${title || (page.id ? abbreviateId(page.id) : "?")}`,
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
    const id = normalizeUuid(String(args.id ?? ""));
    if (!UUID_PATTERN.test(id)) {
      return err("id must be a UUID (page, database, or data_source).");
    }

    try {
      const dataSourceResponse = await publicRequest("GET", `/v1/data_sources/${id}`);
      if (dataSourceResponse.ok) {
        return ok(await describeDataSource(id, dataSourceResponse.body as DataSourceObject));
      }

      const databaseResponse = await publicRequest("GET", `/v1/databases/${id}`);
      if (databaseResponse.ok) {
        const dataSourceId = (databaseResponse.body as DataSourceBody).data_sources?.[0]?.id;
        if (dataSourceId) {
          const resolvedDataSourceResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
          if (resolvedDataSourceResponse.ok) {
            return ok(
              await describeDataSource(
                dataSourceId,
                resolvedDataSourceResponse.body as DataSourceObject,
                `(via database ${abbreviateId(id)})`,
              ),
            );
          }
        }
      }

      const pageResponse = await publicRequest("GET", `/v1/pages/${id}`);
      if (pageResponse.ok) {
        return ok(describePage(pageResponse.body as PageObject));
      }

      return err(
        `Could not describe ${id} — not a readable page, database, or data source (check the id and that NOTION_TOKEN has access).`,
      );
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
