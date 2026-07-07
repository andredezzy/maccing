import { z } from "zod";
import { blockMeta } from "./_envelope";

export const breadcrumb = z.object({
  ...blockMeta,
  type: z.literal("breadcrumb"),
  breadcrumb: z.object({}).passthrough(),
});
