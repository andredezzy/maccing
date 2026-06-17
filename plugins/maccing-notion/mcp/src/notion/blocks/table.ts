import { z } from "zod";
import { richText } from "../rich-text";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

export const table = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("table"),
    table: z.object({
      table_width: z.number().int(),
      has_column_header: z.boolean().optional(),
      has_row_header: z.boolean().optional(),
      children: z.array(blockChild).optional(),
    }),
  });

// table_row is childless; cells is an array of columns, each column being an array of rich_text objects.
export const tableRow = z.object({
  ...blockMeta,
  type: z.literal("table_row"),
  table_row: z.object({
    cells: z.array(z.array(richText)),
  }),
});
