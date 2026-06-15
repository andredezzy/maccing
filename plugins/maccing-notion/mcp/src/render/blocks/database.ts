// The "database" container block — renders a DatabaseModel's header + its selected view (or all views
// stacked). Registered like any block, so a database composes anywhere (inline in a page, or as the
// root that renderDatabase wraps); each view recurses through engine.renderBlock.

import { header } from "../box";
import { register, renderBlock } from "../engine";
import type { DatabaseModel } from "../model";

/** Render a database body (header + the selected view, or all views stacked). */
function renderDatabaseLines(database: DatabaseModel, total: number): string[] {
  const out = header(database.icon, database.title, undefined, database.description, total);
  const which = database.view ?? 0;
  const views = which === "all" ? database.views : [database.views[which]].filter(Boolean);
  for (let index = 0; index < views.length; index++) {
    if (index > 0) {
      out.push("");
    }
    out.push(...renderBlock(views[index], total, 0, 0));
  }
  return out;
}

register("database", (block, width) => renderDatabaseLines(block.database, width));
