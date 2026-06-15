// upsert_property — the universal property writer, the write-dual of `describe`. Create-or-update a
// property on ANY target: a data_source (the COLUMN schema def + its private column icon) or a page
// (the property VALUE). Batched across any mix of targets in one call. `value` is a verbatim Notion
// property object (zero drift). Column icons go through the private app API; everything else public.

import { z } from "zod";
import { decodePropertyId, normalizeUuid, UUID_PATTERN } from "../notion/ids";
import {
  activeUserId,
  type IconRead,
  type PageOrderEntry,
  privateConfig,
  ReadStatus,
  readCollectionIcons,
  readCollectionPageProperties,
  saveTransactions,
  spaceId,
  writeCollectionFormat,
} from "../notion/private-client";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import { type DataSourceBody, formatIconAssetPath, type SchemaBody, type SchemaPropertyRef } from "../readers/schema";
import { err, ok, type ToolModule } from "../tool";
import {
  buildIconOperations,
  describePrivateFailure,
  planUpserts,
  type ResolvedEntry,
  type ResolvedIcon,
  TargetType,
  type VisiblePlanEntry,
} from "../writers/upsert-property";

const COLORS = ["gray", "lightgray", "brown", "yellow", "orange", "green", "blue", "purple", "pink", "red"] as const;

interface PropertyUpsertInput {
  target_id?: string;
  property?: string;
  value?: unknown;
  icon?: string;
  color?: string;
  visible?: boolean;
  remove?: boolean;
  remove_icon?: boolean;
}

interface ResolvedTarget {
  type: TargetType;
  dataSourceId?: string;
}

/** Resolve a property NAME (or id) to its RAW internal id (url-decoded), or null. */
function resolvePropertyId(schema: Record<string, SchemaPropertyRef>, property: string): string | null {
  for (const propertyRef of Object.values(schema)) {
    const decoded = decodePropertyId(propertyRef.id);
    if (propertyRef.name === property || propertyRef.id === property || decoded === property) {
      return decoded;
    }
  }
  return null;
}

interface VisibilityResult {
  report: string;
  didWrite: boolean;
  errors: string[];
}

/**
 * Apply per-property canonical DEFAULT visibility (collection.format.collection_page_properties[].visible) —
 * the row-detail + new-view default. Read-modify-write per data source, preserving order + other props'
 * visibility. Private; degrades gracefully like the icon path.
 */
async function applyCanonicalVisibility(visiblePlan: VisiblePlanEntry[]): Promise<VisibilityResult> {
  const errors: string[] = [];
  const lines: string[] = [];
  let didWrite = false;

  const byDataSource = new Map<string, VisiblePlanEntry[]>();
  for (const entry of visiblePlan) {
    const list = byDataSource.get(entry.dataSourceId) ?? [];
    list.push(entry);
    byDataSource.set(entry.dataSourceId, list);
  }

  for (const [dataSourceId, entries] of byDataSource) {
    const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
    const schema = schemaResponse.ok ? ((schemaResponse.body as SchemaBody).properties ?? {}) : {};

    const read = await readCollectionPageProperties(dataSourceId);
    if (read.status === ReadStatus.THROTTLED) {
      lines.push(describePrivateFailure("throttled"));
      errors.push(`Default visibility not applied on ${dataSourceId} — private read throttled.`);
      continue;
    }
    const pageProperties: PageOrderEntry[] =
      read.pageProperties.length > 0
        ? read.pageProperties.map((entry) => ({ ...entry }))
        : Object.values(schema).map((propertyRef) => ({ property: decodePropertyId(propertyRef.id), visible: true }));

    for (const entry of entries) {
      const rawId = resolvePropertyId(schema, entry.property);
      if (!rawId) {
        errors.push(`Could not resolve "${entry.property}" on ${dataSourceId} for its visibility.`);
        continue;
      }
      const existing = pageProperties.find((pageOrderEntry) => decodePropertyId(pageOrderEntry.property) === rawId);
      if (existing) {
        existing.visible = entry.visible;
      } else {
        pageProperties.push({ property: rawId, visible: entry.visible });
      }
    }

    const write = await writeCollectionFormat(dataSourceId, { collection_page_properties: pageProperties });
    if (write.ok) {
      didWrite = true;
      lines.push(`${entries.length} default-visibility change(s) ✓`);
    } else {
      lines.push(describePrivateFailure(write.body));
    }
  }

  return { report: lines.join("; "), didWrite, errors };
}

/** Probe a target id → is it a data_source (or database→its ds), or a page? */
async function resolveTarget(id: string): Promise<ResolvedTarget | null> {
  const dataSource = await publicRequest("GET", `/v1/data_sources/${id}`);
  if (dataSource.ok) {
    return { type: TargetType.DATA_SOURCE, dataSourceId: id };
  }
  const database = await publicRequest("GET", `/v1/databases/${id}`);
  if (database.ok) {
    const dataSourceId = (database.body as DataSourceBody).data_sources?.[0]?.id;
    if (dataSourceId) {
      return { type: TargetType.DATA_SOURCE, dataSourceId };
    }
  }
  const pageResponse = await publicRequest("GET", `/v1/pages/${id}`);
  if (pageResponse.ok) {
    return { type: TargetType.PAGE };
  }
  return null;
}

/** Per-icon verification line distinguishing confirmed / read-throttled / did-not-persist (no-op name). */
function verifyIcons(icons: ResolvedIcon[], read: IconRead, idToName: Record<string, string>): string {
  if (read.status === ReadStatus.THROTTLED) {
    return `${icons.length} column icon(s) written (saveTransactions 200) — verification read throttled; re-run describe to confirm.`;
  }
  return icons
    .map((icon) => {
      const name = idToName[icon.propertyId] ?? icon.propertyId;
      const persisted = read.byCollection[icon.dataSourceId]?.[icon.propertyId] ?? null;
      if (icon.iconAssetPath === null) {
        return persisted ? `${name}: remove — STILL PRESENT` : `${name}: removed ✓`;
      }
      if (persisted === icon.iconAssetPath) {
        return `${name}: ${formatIconAssetPath(icon.iconAssetPath)} ✓`;
      }
      return `${name}: ${formatIconAssetPath(icon.iconAssetPath)} — DID NOT PERSIST (name may no-op as a property asset; pick another)`;
    })
    .join("\n");
}

export const upsertProperty: ToolModule = {
  name: "upsert_property",
  config: {
    title: "Upsert a Notion property (column or page value)",
    description:
      "Create-or-update a property on ANY target, batched. The write-dual of `describe`. Each entry: " +
      "{ target_id, property, value?, icon?, color?, remove?, remove_icon? }. If target_id is a data_source/" +
      "database → `value` is the COLUMN's schema definition (a verbatim Notion property object, e.g. " +
      "{number:{format}}, {select:{options:[{name,color}]}}, {name:'New name'}) applied via PATCH /v1/data_sources, " +
      "and `icon` sets the COLUMN icon (private app API; the public API can't). If target_id is a page/row → " +
      "`value` is the property VALUE (e.g. {status:{name:'Done'}}, {number:1234}) applied via PATCH /v1/pages; " +
      "`icon` is rejected (page values have no icon — set the PAGE icon via request). `visible` (data_source targets) " +
      "sets the property's DEFAULT visibility — the row-detail panel + new-view default (private; per-property, like " +
      "the icon). `remove` deletes the column / clears the value; `remove_icon` clears a column's icon. Mix any " +
      "targets in one call. (For per-VIEW column order/visibility, use order_properties.) Replaces set_property_icon.",
    annotations: {
      title: "Upsert a Notion property (column or page value)",
      openWorldHint: true,
      destructiveHint: true,
    },
    inputSchema: {
      properties: z
        .array(
          z.object({
            target_id: z.string().describe("A data_source/database id (→ column) or a page/row id (→ value)."),
            property: z.string().describe("Property name (or id)."),
            value: z
              .unknown()
              .optional()
              .describe("Verbatim Notion property object — schema def for a data_source, value for a page."),
            icon: z.string().optional().describe("Column icon name (data_source targets only), e.g. cash."),
            color: z.enum(COLORS).optional().describe("Icon color (default gray)."),
            visible: z
              .boolean()
              .optional()
              .describe(
                "Data_source targets: the property's DEFAULT visibility (row-detail + new-view default; private).",
              ),
            remove: z.boolean().optional().describe("Delete the column / clear the page value."),
            remove_icon: z.boolean().optional().describe("Remove just the column's icon (data_source only)."),
          }),
        )
        .describe("The batch of property upserts — any mix of data sources and pages."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const inputEntries = Array.isArray(args.properties) ? (args.properties as PropertyUpsertInput[]) : null;
    if (!inputEntries || inputEntries.length === 0) {
      return err("`properties` must be a non-empty array of upsert entries.");
    }

    try {
      const errors: string[] = [];

      // 1. Resolve each distinct target's type.
      const targets = new Map<string, ResolvedTarget>();
      for (const id of [...new Set(inputEntries.map((entry) => normalizeUuid(String(entry.target_id ?? ""))))]) {
        if (!UUID_PATTERN.test(id)) {
          errors.push(`"${id}" is not a UUID.`);
          continue;
        }
        const resolvedTarget = await resolveTarget(id);
        if (resolvedTarget) {
          targets.set(id, resolvedTarget);
        } else {
          errors.push(`"${id}" is not a readable page, database, or data source.`);
        }
      }

      // 2. Build resolved entries (data_source ids normalized via the database→ds resolution).
      const resolved: ResolvedEntry[] = [];
      for (const entry of inputEntries) {
        const normalizedId = normalizeUuid(String(entry.target_id ?? ""));
        const resolvedTarget = targets.get(normalizedId);
        if (!resolvedTarget) {
          continue;
        }
        resolved.push({
          targetId:
            resolvedTarget.type === TargetType.DATA_SOURCE
              ? (resolvedTarget.dataSourceId ?? normalizedId)
              : normalizedId,
          targetType: resolvedTarget.type,
          property: String(entry.property ?? ""),
          value: entry.value,
          icon: typeof entry.icon === "string" ? entry.icon : undefined,
          color: typeof entry.color === "string" ? entry.color : undefined,
          visible: typeof entry.visible === "boolean" ? entry.visible : undefined,
          remove: entry.remove === true,
          removeIcon: entry.remove_icon === true,
        });
      }

      const plan = planUpserts(resolved);
      errors.push(...plan.errors);

      // 3. Apply the public PATCHes — data-source schema defs, then page values.
      const applied: string[] = [];
      let anyWrite = false;
      for (const [dataSourceId, properties] of Object.entries(plan.dataSourcePatches)) {
        const response = await publicRequest("PATCH", `/v1/data_sources/${dataSourceId}`, { properties });
        if (response.ok) {
          applied.push(`data_source ${dataSourceId}: ${Object.keys(properties).join(", ")} ✓`);
          anyWrite = true;
        } else {
          errors.push(`PATCH data_source ${dataSourceId} failed: ${JSON.stringify(response.body)}`);
        }
      }
      for (const [pageId, properties] of Object.entries(plan.pagePatches)) {
        const response = await publicRequest("PATCH", `/v1/pages/${pageId}`, { properties });
        if (response.ok) {
          applied.push(`page ${pageId}: ${Object.keys(properties).join(", ")} ✓`);
          anyWrite = true;
        } else {
          errors.push(`PATCH page ${pageId} failed: ${JSON.stringify(response.body)}`);
        }
      }

      // 4. Column icons (private) — resolve names→raw ids on the FRESH schema (catches new/renamed cols), apply, verify.
      let icons = "no column icons in this batch";
      if (plan.iconPlan.length > 0) {
        const config = privateConfig();
        if (!config.ok) {
          errors.push(`Column icons skipped — private API not configured (${config.missing.join(", ")}).`);
          icons = "skipped (private API not configured)";
        } else {
          // The private phase is isolated: any failure (a throttle/connection-reset on getSpaces or
          // saveTransactions) becomes a domain message and is recorded — it must NOT discard the
          // public `applied` results collected above.
          try {
            const iconDataSourceIds = [...new Set(plan.iconPlan.map((entry) => entry.dataSourceId))];
            const schemaById = new Map<string, Record<string, SchemaPropertyRef>>();
            for (const dataSourceId of iconDataSourceIds) {
              const response = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
              if (response.ok) {
                schemaById.set(dataSourceId, (response.body as SchemaBody).properties ?? {});
              }
            }

            const resolvedIcons: ResolvedIcon[] = [];
            for (const entry of plan.iconPlan) {
              const propertyId = resolvePropertyId(schemaById.get(entry.dataSourceId) ?? {}, entry.property);
              if (propertyId) {
                resolvedIcons.push({
                  dataSourceId: entry.dataSourceId,
                  propertyId,
                  iconAssetPath: entry.iconAssetPath,
                });
              } else {
                errors.push(`Could not resolve property "${entry.property}" on ${entry.dataSourceId} for its icon.`);
              }
            }

            if (resolvedIcons.length > 0) {
              const operations = buildIconOperations(resolvedIcons, spaceId(), await activeUserId());
              const saveTransactionsResponse = await saveTransactions(operations);
              if (!saveTransactionsResponse.ok) {
                icons = describePrivateFailure(saveTransactionsResponse.body);
                errors.push(`Column icons not applied — ${icons}`);
              } else {
                anyWrite = true;
                const idToName: Record<string, string> = {};
                for (const schema of schemaById.values()) {
                  for (const propertyRef of Object.values(schema)) {
                    idToName[decodePropertyId(propertyRef.id)] = propertyRef.name;
                  }
                }
                icons = verifyIcons(resolvedIcons, await readCollectionIcons(iconDataSourceIds), idToName);
              }
            }
          } catch (iconError) {
            icons = describePrivateFailure(iconError instanceof Error ? iconError.message : String(iconError));
            errors.push(`Column icons not applied — ${icons}`);
          }
        }
      }

      // 5. Canonical DEFAULT visibility (private) — per-property, the row-detail + new-view default.
      let visibility = "no visibility changes";
      if (plan.visiblePlan.length > 0) {
        const config = privateConfig();
        if (!config.ok) {
          errors.push(`Default visibility skipped — private API not configured (${config.missing.join(", ")}).`);
          visibility = "skipped (private API not configured)";
        } else {
          const result = await applyCanonicalVisibility(plan.visiblePlan);
          visibility = result.report || "no visibility changes";
          errors.push(...result.errors);
          if (result.didWrite) {
            anyWrite = true;
          }
        }
      }

      // Nothing succeeded and we collected errors → a hard error, not a silent no-op result.
      if (!anyWrite && errors.length > 0) {
        return err(errors.join("\n"));
      }

      return ok({
        applied,
        icons,
        visibility,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
