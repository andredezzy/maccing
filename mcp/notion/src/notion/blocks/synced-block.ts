import { z } from "zod";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// synced_from is null for the original block; for copies it carries the originating block reference.
const syncedFrom = z.union([z.object({ type: z.literal("block_id"), block_id: z.string() }), z.null()]);

export const syncedBlock = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("synced_block"),
    synced_block: z.object({
      synced_from: syncedFrom,
      children: z.array(blockChild).optional(),
    }),
  });
