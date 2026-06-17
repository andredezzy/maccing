import { z } from "zod";

import { icon } from "./file";
import { parentRef } from "./parent";
import { propertySchema } from "./property-schema";
import { richText } from "./rich-text";
import { user } from "./user";

// Mirrors developers.notion.com/reference/data-source — holds the actual column schema + rows.
// Dev note: the live doc names the display text field "title" (a rich text array), NOT "name".
// The doc lists no "cover" field on a data source (only database has cover); omitted intentionally.
// "properties" is required — it is the substantive payload of this object.
export const dataSource = z.object({
  object: z.literal("data_source").optional(),
  id: z.string().optional(),

  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: user.optional(),
  last_edited_by: user.optional(),

  // The live doc calls this "title", not "name" — confirmed via working-with-databases guide example.
  title: z.array(richText).optional(),
  description: z.array(richText).optional(),

  icon: icon.nullable().optional(),

  // Parent references the database that owns this data source via type: "database_id".
  parent: parentRef.optional(),

  // The grandparent: where the OWNING database lives (e.g. a page). The data source carries this so a
  // caller knows the database's container without a second fetch — distinct from `parent` (the database).
  database_parent: parentRef.optional(),

  // The column schema — required as the substantive payload; every data source has properties.
  properties: z.record(z.string(), propertySchema),

  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
});

export type DataSourceObject = z.infer<typeof dataSource>;
