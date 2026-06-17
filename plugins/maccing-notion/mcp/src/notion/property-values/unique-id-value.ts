// mirrors developers.notion.com/reference/page-property-values — unique_id property value (read-only)
// readers/page.ts reads: unique_id.prefix and unique_id.number
import { z } from "zod";

const uniqueIdPayload = z.object({
  prefix: z.string().nullable().optional(),
  number: z.number().nullable().optional(),
});

export const uniqueIdValue = z.object({
  id: z.string().optional(),
  type: z.literal("unique_id"),
  unique_id: uniqueIdPayload,
});
