// Database renderer — consumes the official DatabaseRender bundle directly.
// Builds the ViewRenderNode for each view and dispatches through the view engine.

import type { DatabaseRender } from "../../../notion/render-bundles";
import { iconGlyph } from "../../../readers/object";
import { richTextToPlain } from "../../../readers/page";
import { header } from "../../box";
import { renderView, renderViews, type ViewRenderNode } from "./views/engine";

/** Derive the title-typed column name from the data source schema. */
function titleColumnOf(schema: Record<string, { type?: string }>): string {
  return (
    Object.entries(schema).find(([, property]) => property.type === "title")?.[0] ?? Object.keys(schema)[0] ?? "Name"
  );
}

/** Render a DatabaseRender bundle into lines. selectedView: index, "all", or undefined (default: 0). */
export function renderDatabase(bundle: DatabaseRender, width: number, selectedView?: number | "all"): string[] {
  const { database, dataSource, views: viewObjects, rows } = bundle;

  const dbTitle = richTextToPlain(database.title) || "(database)";
  const icon = iconGlyph(database.icon);
  const schema = dataSource.properties ?? {};
  const titleColumn = titleColumnOf(schema);
  const tabs = viewObjects.map((view) => view.name ?? "");

  const headerLines = header(icon, dbTitle, undefined, undefined, width);

  const which = selectedView ?? 0;

  if (viewObjects.length === 0) {
    return headerLines;
  }

  if (which === "all") {
    const nodes: ViewRenderNode[] = viewObjects.map((view) => ({
      type: view.type,
      view,
      rows,
      dataSource,
      dbTitle,
      tabs,
      titleColumn,
    }));
    return [...headerLines, ...renderViews(nodes, width)];
  }

  const resolvedIndex = typeof which === "number" && which >= 0 && which < viewObjects.length ? which : 0;
  const selectedViewObj = viewObjects[resolvedIndex];
  const node: ViewRenderNode = {
    type: selectedViewObj.type,
    view: selectedViewObj,
    rows,
    dataSource,
    dbTitle,
    tabs,
    titleColumn,
  };
  return [...headerLines, ...renderView(node, width, 0, 0)];
}
