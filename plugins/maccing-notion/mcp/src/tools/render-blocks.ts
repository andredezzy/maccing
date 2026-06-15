// render_blocks — render a flat or nested array of blocks in isolation (no page header/cover/title)
// as the fixed-width ASCII mockup. Handy for previewing a block subtree or a synced block's children.

import { z } from "zod";
import { type MockupBlock, renderBlocks } from "../render";
import { blockSchema } from "../render/schema";
import { err, ok, type ToolModule } from "../tool";

export const renderBlocksTool: ToolModule = {
  name: "render_blocks",
  config: {
    title: "Render a Notion block subtree",
    description:
      "Render an array of `blocks` (flat or nested, same Block shapes as render_page) as the fixed-width " +
      "ASCII mockup, WITHOUT a page header — just the block body. Optional `width` (default 70). Useful for " +
      "previewing a block subtree or a synced block's children. The renderer owns all alignment.",
    annotations: { title: "Render a Notion block subtree", readOnlyHint: true },
    inputSchema: {
      blocks: z.array(blockSchema),
      width: z.number().optional().describe("columns (default 70)"),
    },
  },
  handler: async (args) => {
    try {
      const blocks = z.array(blockSchema).parse(args.blocks) as MockupBlock[];
      const width = typeof args.width === "number" && args.width > 0 ? args.width : 70;
      return ok(
        renderBlocks(blocks, width, 0)
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trimEnd(),
      );
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
