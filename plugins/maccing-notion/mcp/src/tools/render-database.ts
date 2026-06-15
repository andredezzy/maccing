// render_database — render a STANDALONE Notion database (its own header + one view, or every view
// stacked) as the fixed-width ASCII mockup. For previewing/proposing a database on its own, not inside
// a page. Each view is a table/gallery/board/list block; the renderer owns all alignment.

import { type DatabaseModel, renderDatabase } from "../render";
import { databaseModelSchema } from "../render/schema";
import { err, ok, type ToolModule } from "../tool";

export const renderDatabaseTool: ToolModule = {
  name: "render_database",
  config: {
    title: "Render a standalone database mockup",
    description:
      "Render a STANDALONE database as the fixed-width ASCII mockup (its own icon+title header + a view). " +
      "`database_model`: { title, icon?, description?, views[], view? }. Each view is one of: " +
      "table {name,views?,columns[],rows[][]} · gallery {name,views?,cardSize?,cards[]} · " +
      "board {name,views?,groups[{name,cards[]}]} · list {name,views?,items[{icon?,title,meta?}]}. " +
      "`view` selects which to render: an index (default 0), or 'all' to stack every view. " +
      "Use this to preview/propose a database on its own. The renderer owns all alignment.",
    annotations: { title: "Render a standalone database mockup", readOnlyHint: true },
    inputSchema: { database_model: databaseModelSchema },
  },
  handler: async (args) => {
    try {
      const model = databaseModelSchema.parse(args.database_model) as DatabaseModel;
      return ok(renderDatabase(model));
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
