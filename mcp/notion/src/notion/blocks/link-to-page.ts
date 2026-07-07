import { z } from "zod";
import { blockMeta } from "./_envelope";

// link_to_page is a real API-accepted block (link to another page) that the current block reference
// enumerates only tersely; kept for faithfulness, shape mirrors the parent-ref convention.
// link_to_page points to a page, database, or comment; the payload mirrors the parent ref structure
// but only carries one of page_id, database_id, or comment_id per the API docs.
export const linkToPage = z.object({
  ...blockMeta,
  type: z.literal("link_to_page"),
  link_to_page: z.object({
    type: z.enum(["page_id", "database_id", "comment_id"]).optional(),
    page_id: z.string().optional(),
    database_id: z.string().optional(),
    comment_id: z.string().optional(),
  }),
});
