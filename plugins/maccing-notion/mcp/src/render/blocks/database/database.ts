// Database renderer — consumes the official DatabaseRender bundle directly.
// Builds the ViewRenderNode for each view and dispatches through the view engine.

import type { DatabaseRender } from "../../../notion/render-bundles";
import type { ViewObject } from "../../../notion/view";
import { richTextToPlain } from "../../../readers/page";
import { databaseHeader } from "./header";
import { renderView, type ViewRenderNode } from "./views/engine";

/** Fence that wraps the box-art grid so it renders monospace; the prose header sits OUTSIDE it (bold). */
const FENCE = "```";

/** Derive the title-typed column name from the data source schema. */
function titleColumnOf(schema: Record<string, { type?: string }>): string {
  return (
    Object.entries(schema).find(([, property]) => property.type === "title")?.[0] ?? Object.keys(schema)[0] ?? "Name"
  );
}

/**
 * Render a DatabaseRender bundle into lines. selectedView: index, "all", or undefined (default: 0).
 * Each view becomes a complete chat-ready mockup: the PROSE header (◷ **title** + a Views line whose
 * SELECTED view is in real **bold**) followed by the box-art grid wrapped in a ``` code fence. The header is
 * prose because bold only renders OUTSIDE a fence; the grid is fenced because alignment only holds inside one.
 */
export function renderDatabase(bundle: DatabaseRender, width: number, selectedView?: number | "all"): string[] {
  const { database, dataSource, views: viewObjects, rows } = bundle;

  const dbTitle = richTextToPlain(database.title) || "(database)";
  const schema = dataSource.properties ?? {};
  const titleColumn = titleColumnOf(schema);
  const tabs = viewObjects.map((view) => view.name ?? "");

  if (viewObjects.length === 0) {
    return databaseHeader(dbTitle, [], undefined, width); // just the ◷ title line (prose; no grid to fence)
  }

  const nodeFor = (view: ViewObject): ViewRenderNode => ({
    type: view.type,
    view,
    rows,
    dataSource,
    dbTitle,
    tabs,
    titleColumn,
  });

  const which = selectedView ?? 0;

  if (which === "all") {
    const out: string[] = [];
    for (let index = 0; index < viewObjects.length; index++) {
      if (index > 0) {
        out.push("");
      }
      out.push(...viewMockup(nodeFor(viewObjects[index]), width));
    }
    return out;
  }

  const resolvedIndex = typeof which === "number" && which >= 0 && which < viewObjects.length ? which : 0;
  return viewMockup(nodeFor(viewObjects[resolvedIndex]), width);
}

/** One view's mockup: the prose header, then the grid in a code fence. */
function viewMockup(node: ViewRenderNode, width: number): string[] {
  return [
    ...databaseHeader(node.dbTitle, node.tabs, node.view.name, width),
    "",
    FENCE,
    ...renderView(node, width, 0, 0),
    FENCE,
  ];
}
