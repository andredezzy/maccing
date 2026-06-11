// Typed convenience for the verified flagship private capability: set/remove a database
// PROPERTY (column) icon. Encapsulates the gotchas — public-API name→raw-id resolution, the
// updateCollectionPropertySchema + commit ops, the /icons/<file>_<color>.svg path — and verifies
// by reading the internal schema back (the public API never exposes property icons).

import { z } from "zod";
import {
  activeUserId,
  collectionCommitOp,
  getRecordValues,
  privateConfig,
  saveTransactions,
  spaceId,
} from "../lib/notion-private";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { err, ok, type ToolModule } from "../tool";

const COLORS = ["gray", "lightgray", "brown", "yellow", "orange", "green", "blue", "purple", "pink", "red"] as const;
const DATA_SOURCE_ID = /^[0-9a-f-]{32,36}$/i;
const ICON_NAME = /^[a-z0-9_-]+$/i;

interface DataSourceSchema {
  properties: Record<string, { id: string; name: string }>;
}

/** Resolve a property NAME (or id) to its RAW internal id (url-decoded), or null if it can't be found. */
async function resolvePropertyId(dataSourceId: string, property: string): Promise<string | null> {
  const response = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
  if (!response.ok || typeof response.body !== "object" || response.body === null) {
    return null;
  }

  const schema = response.body as DataSourceSchema;
  for (const definition of Object.values(schema.properties)) {
    const decodedId = decodeURIComponent(definition.id);
    if (definition.name === property || decodedId === property || definition.id === property) {
      return decodedId;
    }
  }

  return null;
}

interface RecordValuesBody {
  results?: { value?: { schema?: Record<string, { icon?: string }> } }[];
}

function extractIcon(body: unknown, propertyId: string): string | null {
  const typed = body as RecordValuesBody;
  return typed?.results?.[0]?.value?.schema?.[propertyId]?.icon ?? null;
}

export const setPropertyIcon: ToolModule = {
  name: "notion_set_property_icon",
  config: {
    title: "Set Notion property/column icon (unofficial)",
    description:
      "Set or remove the ICON on a database PROPERTY/column (the icon next to a column name) — impossible " +
      "via the public API; done through the private app API (needs NOTION_TOKEN_V2 + NOTION_TOKEN configured). " +
      "`icon` is an internal asset name that usually matches the built-in catalog (references/icon-names.md: " +
      "cash, star, …) but not always — this tool reads the schema back and reports whether it persisted. " +
      "UNOFFICIAL/ToS-risk; propose to the user first.",
    annotations: { title: "Set Notion property/column icon (unofficial)", openWorldHint: true, destructiveHint: true },
    inputSchema: {
      data_source_id: z.string().describe("The data source (collection) id."),
      property: z.string().describe("Property name or id."),
      icon: z.string().optional().describe("Icon name, e.g. cash. Omit when remove=true."),
      color: z.enum(COLORS).optional().describe("Icon color (default gray)."),
      remove: z.boolean().optional().describe("Remove the property's icon instead of setting one."),
    },
  },

  handler: async (args) => {
    const config = privateConfig();
    if (!config.ok) {
      return err(`Private API not configured — missing ${config.missing.join(", ")} in the MCP env (mcp/.env.local).`);
    }
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set (needed to resolve the property id).");
    }

    const dataSourceId = String(args.data_source_id);
    if (!DATA_SOURCE_ID.test(dataSourceId)) {
      return err("data_source_id must be a UUID.");
    }

    const remove = args.remove === true;
    const color = typeof args.color === "string" ? args.color : "gray";

    if (!remove && (typeof args.icon !== "string" || !ICON_NAME.test(args.icon))) {
      return err("Provide a valid `icon` name ([a-z0-9_-]), or set remove=true.");
    }

    const iconValue = remove ? null : `/icons/${args.icon}_${color}.svg`;

    try {
      const propertyId = await resolvePropertyId(dataSourceId, String(args.property));
      if (!propertyId) {
        return err(
          `Could not resolve property "${String(args.property)}" on ${dataSourceId} — check the id and that NOTION_TOKEN has access.`,
        );
      }

      const activeUser = await activeUserId();
      const operations = [
        {
          pointer: { table: "collection", id: dataSourceId, spaceId: spaceId() },
          command: "updateCollectionPropertySchema",
          path: ["schema", propertyId, "icon"],
          args: { primitiveOp: { command: "set", args: iconValue } },
        },
        collectionCommitOp(dataSourceId, activeUser),
      ];

      const setResponse = await saveTransactions(operations);
      if (!setResponse.ok) {
        return { content: [{ type: "text", text: JSON.stringify(setResponse, null, 2) }], isError: true };
      }

      const readback = await getRecordValues([{ id: dataSourceId, table: "collection" }]);
      const persisted = extractIcon(readback.body, propertyId);
      const verified = persisted === iconValue;

      return ok({
        property: propertyId,
        set: iconValue ?? "(removed)",
        persisted: persisted ?? "(absent)",
        verified,
        note: verified
          ? "Confirmed via the internal schema (the public API never shows it — verify visually in Notion)."
          : "saveTransactions returned 200 but read-back didn't match — the icon name may not map to a real /icons/<file>.svg, or the read was rate-limited; retry.",
      });
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
