// The "database" container block — renders a DatabaseModel's header + its selected view (or all views
// stacked). Registered like any block, so a database composes anywhere (inline in a page, or as the
// top-level database block render() dispatches); each view recurses through the view engine.

import { header } from "../../box";
import { registerBlock } from "../engine";
import { type DatabaseView, renderViews } from "./views/engine";

export interface DatabaseModel {
  title: string;
  icon?: string;
  description?: string;
  width?: number;
  views: DatabaseView[];
  /** which view to render: an index, or "all" for every view stacked. Default 0. */
  view?: number | "all";
}
/** The standalone-database block — wraps a DatabaseModel. A database IS a block too. */
export interface DatabaseBlock {
  type: "database";
  database: DatabaseModel;
}

/** Render a database body (header + the selected view, or all views stacked). */
function renderDatabaseLines(database: DatabaseModel, total: number): string[] {
  const out = header(database.icon, database.title, undefined, database.description, total);
  const which = database.view ?? 0;
  const selected = which === "all" ? database.views : [database.views[which]].filter(Boolean);
  return [...out, ...renderViews(selected, total)];
}

registerBlock("database", (block, width) => renderDatabaseLines(block.database, width));
