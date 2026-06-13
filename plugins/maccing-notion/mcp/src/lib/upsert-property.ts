// Pure planning logic for the universal `upsert_property` tool — the write-dual of `describe`.
// Splits a flat batch of property upserts (already resolved to their target TYPE) into the public
// PATCH bodies (data-source schema defs + page values) and the private icon operations, with zero
// network. The handler does the I/O (probe target types, PATCH, resolve raw ids, saveTransactions).

export type TargetType = "data_source" | "page";

export interface ResolvedEntry {
  targetId: string;
  targetType: TargetType;
  property: string;
  /** Verbatim Notion property object — a schema def for a data_source, a value for a page. */
  value?: unknown;
  icon?: string;
  color?: string;
  /** The property's canonical DEFAULT visibility (data_source targets only; row-detail + new-view default). */
  visible?: boolean;
  /** Delete the whole property (column or page value). */
  remove?: boolean;
  /** Remove just the column icon, keeping the column (data_source only). */
  removeIcon?: boolean;
}

/** A canonical default-visibility change for one property (collection.format.collection_page_properties). */
export interface VisiblePlanEntry {
  dataSourceId: string;
  property: string;
  visible: boolean;
}

/** A column-icon assignment, keyed by property NAME — the handler resolves the name to a raw id. */
export interface IconPlanEntry {
  dataSourceId: string;
  property: string;
  iconValue: string | null;
}

export interface UpsertPlan {
  dataSourcePatches: Record<string, Record<string, unknown>>;
  pagePatches: Record<string, Record<string, unknown>>;
  iconPlan: IconPlanEntry[];
  visiblePlan: VisiblePlanEntry[];
  errors: string[];
}

/** A private api/v3 saveTransactions operation. */
export interface SaveOp {
  pointer: { table: string; id: string; spaceId?: string };
  command: string;
  path: string[];
  args: Record<string, unknown>;
}

/** "/icons/<file>_<color>.svg" — color defaults to gray, the workspace house style. */
export function iconAssetPath(icon: string, color = "gray"): string {
  return `/icons/${icon}_${color}.svg`;
}

const THROTTLE_SIGNATURE =
  /throttl|bot.?page|bot-protection|rate.?limit|unreachable|connection|socket|closed unexpectedly|non-json|hang up/i;

/**
 * Turn a failed private-API body into a user-facing message. A connection reset / bot page is the
 * session's bot-protection, NOT a real failure — say so and reassure that the public schema/value
 * changes already landed. A genuine API error (a JSON validation body) is surfaced, not masked.
 */
export function describePrivateFailure(body: unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (THROTTLE_SIGNATURE.test(text)) {
    return "private app API throttled (bot protection) — column icons not applied (any public schema/value changes in this batch are listed under `applied`); retry the icon entries in a moment.";
  }
  return `private write failed: ${text.slice(0, 300)}`;
}

/** Set buckets[id][key] = value, creating the per-target bucket on first use. */
function assign(buckets: Record<string, Record<string, unknown>>, id: string, key: string, value: unknown): void {
  if (!buckets[id]) {
    buckets[id] = {};
  }
  buckets[id][key] = value;
}

/** Split a resolved batch into public PATCH bodies (per data source / per page) + the icon plan. */
export function planUpserts(entries: ResolvedEntry[]): UpsertPlan {
  const dataSourcePatches: Record<string, Record<string, unknown>> = {};
  const pagePatches: Record<string, Record<string, unknown>> = {};
  const iconPlan: IconPlanEntry[] = [];
  const visiblePlan: VisiblePlanEntry[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    if (entry.targetType === "page") {
      if (entry.icon || entry.removeIcon) {
        errors.push(
          `"${entry.property}" on page ${entry.targetId}: page property values have no icon — set the PAGE's icon via request PATCH /v1/pages instead.`,
        );
      }
      if (entry.visible !== undefined) {
        errors.push(
          `"${entry.property}" on page ${entry.targetId}: a page value has no visibility — \`visible\` only applies to a data_source property's default visibility.`,
        );
      }
      if (entry.remove) {
        assign(pagePatches, entry.targetId, entry.property, null);
      } else if (entry.value !== undefined) {
        assign(pagePatches, entry.targetId, entry.property, entry.value);
      }
      continue;
    }

    // data_source target → column schema def + optional column icon
    if (entry.remove) {
      assign(dataSourcePatches, entry.targetId, entry.property, null);
      continue; // deleting the column makes any icon moot
    }
    if (entry.value !== undefined) {
      assign(dataSourcePatches, entry.targetId, entry.property, entry.value);
    }
    if (entry.icon) {
      iconPlan.push({
        dataSourceId: entry.targetId,
        property: entry.property,
        iconValue: iconAssetPath(entry.icon, entry.color),
      });
    } else if (entry.removeIcon) {
      iconPlan.push({ dataSourceId: entry.targetId, property: entry.property, iconValue: null });
    }
    if (entry.visible !== undefined) {
      visiblePlan.push({ dataSourceId: entry.targetId, property: entry.property, visible: entry.visible });
    }
  }

  return { dataSourcePatches, pagePatches, iconPlan, visiblePlan, errors };
}

interface ResolvedIcon {
  dataSourceId: string;
  propertyId: string;
  iconValue: string | null;
}

/** Build the saveTransactions ops for a set of resolved column icons: one schema op each + one commit per data source. */
export function buildIconOperations(icons: ResolvedIcon[], spaceId: string | undefined, activeUser: string): SaveOp[] {
  const ops: SaveOp[] = icons.map((icon) => ({
    pointer: { table: "collection", id: icon.dataSourceId, spaceId },
    command: "updateCollectionPropertySchema",
    path: ["schema", icon.propertyId, "icon"],
    args: { primitiveOp: { command: "set", args: icon.iconValue } },
  }));

  for (const dataSourceId of [...new Set(icons.map((icon) => icon.dataSourceId))]) {
    ops.push({
      pointer: { table: "collection", id: dataSourceId, spaceId },
      command: "update",
      path: [],
      args: { last_edited_by_id: activeUser, last_edited_by_table: "notion_user" },
    });
  }

  return ops;
}

interface CollectionsBody {
  results?: { value?: { schema?: Record<string, { icon?: string }> } }[];
}

/** Parse a getRecordValues collection read into { dataSourceId → { rawPropertyId → iconAsset } }. */
export function parseCollectionIcons(body: unknown, dataSourceIds: string[]): Record<string, Record<string, string>> {
  const results = (body as CollectionsBody).results ?? [];
  const byCollection: Record<string, Record<string, string>> = {};

  dataSourceIds.forEach((dataSourceId, index) => {
    const schema = results[index]?.value?.schema ?? {};
    const icons: Record<string, string> = {};
    for (const [propertyId, definition] of Object.entries(schema)) {
      if (definition?.icon) {
        icons[propertyId] = definition.icon;
      }
    }
    byCollection[dataSourceId] = icons;
  });

  return byCollection;
}
