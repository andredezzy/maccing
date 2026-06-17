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
  /** Inline (within-a-page) rendering caps wide tables to the columns that stay readable at the canvas width,
   *  with a "+N more columns" marker; the standalone database mockup leaves this unset to show every column. */
  capColumns?: boolean;
}

const views = createRegistry<ViewRenderNode>();
export const registerView = views.register;
export const renderView = views.render;
