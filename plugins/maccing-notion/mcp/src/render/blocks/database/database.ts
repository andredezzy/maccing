// Database renderer — consumes the official DatabaseRender bundle directly.
// Builds the ViewRenderNode for each view and dispatches through the view engine.

import type { DatabaseRender, InlineDatabaseRender } from "../../../notion/render-bundles";
import type { ViewObject } from "../../../notion/view";
import { richTextToPlain } from "../../../readers/page";
import { codeFence } from "../../text";
import { databaseHeader } from "./header";
import { renderView, type ViewRenderNode } from "./views/engine";

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

/** One view's mockup: the prose header (kept OUTSIDE the fence so the selected view renders bold), then the
 * box-art grid in a code fence — backtick-safe so a cell value containing ``` can't terminate it early. */
function viewMockup(node: ViewRenderNode, width: number): string[] {
  return [
    ...databaseHeader(node.dbTitle, node.tabs, node.view.name, width),
    "",
    codeFence(renderView(node, width, 0, 0).join("\n")),
  ];
}

/**
 * Inline (within a page) rendering of a child_database: a plain `▦ Title` heading + the default view's box-art
 * grid. NO code fence and NO bold prose header — the surrounding page is already wrapped in ONE fence, inside
 * which bold can't render; the standalone `renderDatabase` keeps the fenced, bold-header treatment for
 * `database_id`. This is the page → view-engine bridge, in one direction. Appends a note when rows were sampled.
 */
export function renderInlineDatabase(inline: InlineDatabaseRender, width: number): string[] {
  const { bundle, selectedView, truncated } = inline;
  const { database, dataSource, views: viewObjects, rows } = bundle;

  const dbTitle = richTextToPlain(database.title) || "(database)";
  const heading = `▦ ${dbTitle}`;
  if (viewObjects.length === 0) {
    return [heading];
  }

  const index = selectedView >= 0 && selectedView < viewObjects.length ? selectedView : 0;
  const view = viewObjects[index];
  const node: ViewRenderNode = {
    type: view.type,
    view,
    rows,
    dataSource,
    dbTitle,
    tabs: viewObjects.map((tab) => tab.name ?? ""),
    titleColumn: titleColumnOf(dataSource.properties ?? {}),
    capColumns: true, // inline within a page: cap wide tables to the readable few (standalone shows all)
  };

  const grid = renderView(node, width, 0, 0);
  return truncated ? [heading, ...grid, "(+ more rows — open the database to see all)"] : [heading, ...grid];
}
