import { z } from "zod";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// column_list contains column blocks as children; its own payload is empty.
// column_list payload is empty per docs; _blockChild kept to match the factory signature convention.
export const columnList = (_blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("column_list"),
    column_list: z.object({}).passthrough(),
  });

// column contains any block children; width_ratio is an optional layout hint (0–1).
export const column = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("column"),
    column: z.object({
      width_ratio: z.number().optional(),
      children: z.array(blockChild).optional(),
    }),
  });
