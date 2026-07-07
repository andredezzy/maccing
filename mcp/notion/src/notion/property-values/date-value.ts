// mirrors developers.notion.com/reference/page-property-values — date property value
// datePayload is exported for reuse in formula/rollup/verification where a date range appears.
import { z } from "zod";

export const datePayload = z.object({
  start: z.string(),
  end: z.string().nullable().optional(),
  time_zone: z.string().nullable().optional(),
});

export const dateValue = z.object({
  id: z.string().optional(),
  type: z.literal("date"),
  date: datePayload.nullable(),
});
