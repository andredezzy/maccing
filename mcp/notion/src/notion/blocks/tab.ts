import { z } from "zod";
import { blockMeta } from "./_envelope";
import type { BlockObject } from "./block";

// tab is a tabbed container block. Each direct child is a paragraph block: the paragraph's rich_text
// is the tab label, its icon sets the tab icon, and its own children hold the tab's content.
// The tab payload itself is an empty object (the tab structure is expressed through its children).
export const tab = (blockChild: z.ZodType<BlockObject>) =>
  z.object({
    ...blockMeta,
    type: z.literal("tab"),
    tab: z.object({ children: z.array(blockChild).optional() }).passthrough(),
  });
