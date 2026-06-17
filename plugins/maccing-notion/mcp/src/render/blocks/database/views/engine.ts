// View render engine — dispatches on ViewRenderNode.type (= view.type, the official ViewObject's discriminant).
// Each renderer reads from the official ViewObject + PageObject rows + DataSourceObject schema directly;
// no intermediate simplified model.

import type { DataSourceObject } from "../../../../notion/data-source";
import type { PageObject } from "../../../../notion/page";
import type { ViewObject } from "../../../../notion/view";
import { createRegistry } from "../../../registry";

/** All the official data a view renderer needs. The `type` field mirrors `view.type` so createRegistry dispatches. */
export interface ViewRenderNode {
  type: string;
  view: ViewObject;
  rows: PageObject[];
  dataSource: DataSourceObject;
  /** Database display title (rich-text resolved to plain string) shown in the header. */
  dbTitle: string;
  tabs: string[];
  titleColumn: string;
}

const views = createRegistry<ViewRenderNode>();
export const registerView = views.register;
export const renderView = views.render;

/** Stack views with a blank line between (database view:"all", dashboard widgets). */
export function renderViews(list: ViewRenderNode[], width: number): string[] {
  const out: string[] = [];
  for (let index = 0; index < list.length; index++) {
    if (index > 0) {
      out.push("");
    }
    out.push(...renderView(list[index], width, 0, 0));
  }
  return out;
}
