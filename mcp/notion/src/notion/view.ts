import { z } from "zod";

// Mirrors a Notion database view returned by GET /v1/views/{id}.
// Cross-checked against readers/views.ts (RawView) and the working-with-views guide:
//   • sorts, filter, quick_filters are TOP-LEVEL fields (RawView confirms; they are NOT inside configuration).
//   • configuration is an opaque sub-object — the reader passes it verbatim to resolveDeep, so we
//     only type the fields that the renderer and renderer helpers actually read field-by-field:
//     `properties` (array of column visibility/width entries) and `group_by`.
//   • filter/sorts kept loose (z.unknown/z.array(z.unknown)) — verbatim Notion filter/sort objects,
//     not needed field-by-field by the renderer.

const viewProperty = z.object({
  property_id: z.string(),
  visible: z.boolean().optional(),
  width: z.number().optional(),
});

const viewConfiguration = z
  .object({
    // Column visibility / width list; the renderer resolves property_id → name via resolveDeep.
    properties: z.array(viewProperty).optional(),
    // Remaining configuration fields are view-type-specific blobs — kept passthrough so unknown
    // keys from the live API flow through without validation errors.
    group_by: z.unknown().optional(),
    date_property_id: z.string().optional(),
  })
  .passthrough();

export const view = z.object({
  object: z.literal("view").optional(),
  id: z.string().optional(),
  name: z.string(),
  type: z.enum([
    "table",
    "board",
    "gallery",
    "list",
    "calendar",
    "timeline",
    "chart",
    "form",
    "map",
    "dashboard",
    "feed",
  ]),
  url: z.string().optional(),
  // parent carries the owning database_id (readers/views.ts RawView: parent?: { database_id?: string }).
  parent: z.object({ database_id: z.string().optional() }).optional(),
  data_source_id: z.string().optional(),
  // Top-level filter/sorts/quick_filters — NOT inside configuration (readers/views.ts confirms).
  // sorts is nullable: the live API returns `sorts: null` on an unsorted view.
  sorts: z.array(z.unknown()).nullable().optional(),
  filter: z.unknown().optional(),
  quick_filters: z.unknown().optional(),
  configuration: viewConfiguration.nullable().optional(),
});
