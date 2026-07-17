// mirrors developers.notion.com/reference/page. Server-set metadata is optional so a hand-authored
// page proposal (no id/timestamps/url) still validates; `properties` is the substantive payload.
import { z } from "zod";

import { cover, icon } from "./file";
import { parentRef } from "./parent";
import { propertyValue } from "./property-values/property-value";
import { user } from "./user";

export const page = z.object({
  object: z.literal("page").optional(),
  id: z.string().optional(),

  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: user.optional(),
  last_edited_by: user.optional(),

  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),

  icon: icon.nullable().optional(),
  cover: cover.nullable().optional(),

  parent: parentRef.optional(),

  // A record keyed by property name → discriminated property value. Required: every page has a
  // properties object (even workspace-level pages carry an empty {}); omitting it is not a valid page.
  properties: z.record(z.string(), propertyValue),

  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});
