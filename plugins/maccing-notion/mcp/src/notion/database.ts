import { z } from "zod";

import { cover, icon } from "./file";
import { parentRef } from "./parent";
import { richText } from "./rich-text";
import { user } from "./user";

// Each data_sources item carries {id, name} — confirmed against the live working-with-databases guide;
// full detail is fetched via the "Retrieve a data source" endpoint.
const dataSourceRef = z.object({ id: z.string(), name: z.string() });

// Mirrors developers.notion.com/reference/database — the 2026 wrapper. The column schema lives on
// the data sources (see data-source.ts), NOT here; this object only points at them via `data_sources`.
export const database = z.object({
  object: z.literal("database").optional(),
  id: z.string().optional(),

  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: user.optional(),
  last_edited_by: user.optional(),

  title: z.array(richText).optional(),
  description: z.array(richText).optional(),

  icon: icon.nullable().optional(),
  cover: cover.nullable().optional(),

  parent: parentRef.optional(),

  // Pointer array to the data sources; fetch individual data sources for the full properties schema.
  data_sources: z.array(dataSourceRef).optional(),

  is_inline: z.boolean().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),

  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

export type DatabaseObject = z.infer<typeof database>;
