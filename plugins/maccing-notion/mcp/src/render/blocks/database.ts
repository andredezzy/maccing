// The "database" container block — renders a DatabaseModel's header + its selected view (or all views
// stacked). Registered like any block, so a database composes anywhere (inline in a page, or as the
// top-level database block render() dispatches); each view recurses through engine.renderBlock.

import { header } from "../box";
import { register, renderBlock } from "../engine";
import type { BoardBlock, GalleryBlock } from "./cards";
import type { ChartBlock, DashboardBlock, FormBlock, MapBlock, TableBlock } from "./data";
import type { ListBlock } from "./list";
import type { CalendarBlock, TimelineBlock } from "./time";

/** The view blocks a database can hold (its `views[]`) — also renderable on their own. */
export type ViewBlock =
  | TableBlock
  | GalleryBlock
  | BoardBlock
  | ListBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock;

/** A database rendered on its own (standalone): a header + one or more view blocks. */
export interface DatabaseModel {
  title: string;
  icon?: string;
  description?: string;
  width?: number;
  views: ViewBlock[];
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
