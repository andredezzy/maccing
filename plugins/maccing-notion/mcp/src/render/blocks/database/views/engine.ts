import { createRegistry } from "../../../registry";
import type { BoardBlock } from "./board";
import type { CalendarBlock } from "./calendar";
import type { ChartBlock } from "./chart";
import type { DashboardBlock } from "./dashboard";
import type { FeedBlock } from "./feed";
import type { FormBlock } from "./form";
import type { GalleryBlock } from "./gallery";
import type { ListBlock } from "./list";
import type { MapBlock } from "./map";
import type { TableBlock } from "./table";
import type { TimelineBlock } from "./timeline";

export type DatabaseView =
  | TableBlock
  | BoardBlock
  | GalleryBlock
  | ListBlock
  | CalendarBlock
  | TimelineBlock
  | ChartBlock
  | FormBlock
  | MapBlock
  | DashboardBlock
  | FeedBlock;

const views = createRegistry<DatabaseView>();
export const registerView = views.register;
export const renderView = views.render;

/** Stack views with a blank line between (database view:"all", dashboard widgets). */
export function renderViews(list: DatabaseView[], width: number): string[] {
  const out: string[] = [];
  for (let index = 0; index < list.length; index++) {
    if (index > 0) {
      out.push("");
    }
    out.push(...renderView(list[index], width, 0, 0));
  }
  return out;
}
