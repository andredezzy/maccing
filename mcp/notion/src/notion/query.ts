import { z } from "zod";

import { page } from "./page";

// Mirrors the POST /v1/data_sources/{id}/query response — a paginated list of page (row) objects.
// `results` uses the canon `page` schema (Task 5) so every row is a fully-typed page object.
export const queryResult = z.object({
  object: z.literal("list").optional(),
  type: z.string().optional(),
  results: z.array(page),
  has_more: z.boolean().optional(),
  next_cursor: z.string().nullable().optional(),
});
