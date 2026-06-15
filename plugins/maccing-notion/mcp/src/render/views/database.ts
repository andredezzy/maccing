// Standalone-database driver — renders a DatabaseModel's header + its selected view (or all views
// stacked), and registers the inline "database" block (which recurses through engine.renderBlock).

import { header } from "../box";
import { register, renderBlock } from "../engine";
import type { DatabaseModel } from "../model";

/** Render a standalone database body (header + the selected view, or all views stacked). */
export function renderDatabaseLines(db: DatabaseModel, total: number): string[] {
  const out = header(db.icon, db.title, undefined, db.description, total);
  const which = db.view ?? 0;
  const views = which === "all" ? db.views : [db.views[typeof which === "number" ? which : 0]].filter(Boolean);
  for (let i = 0; i < views.length; i++) {
    if (i > 0) {
      out.push("");
    }
    out.push(...renderBlock(views[i], total, 0, 0));
  }
  return out;
}

register("database", (block, width) => renderDatabaseLines(block.database, width));
