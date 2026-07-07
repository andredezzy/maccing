import { z } from "zod";
import { blockMeta } from "./_envelope";

// child_page and child_database are created via their own API endpoints; the block carries only a title.
export const childPage = z.object({
  ...blockMeta,
  type: z.literal("child_page"),
  child_page: z.object({ title: z.string() }),
});

export const childDatabase = z.object({
  ...blockMeta,
  type: z.literal("child_database"),
  child_database: z.object({ title: z.string() }),
});
