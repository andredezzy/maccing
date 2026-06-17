// Deterministic ASCII "page mockup" renderer — a COMPOUNDING (recursive, width-flowing) renderer that
// turns a structured model into a faithful, fixed-width visual of how a Notion page / database / block
// subtree looks. The renderer OWNS all alignment: it pads/truncates by DISPLAY width (emoji = 2 cells,
// ZWJ/skin/VS grapheme clusters = one glyph) and word-wraps long text, so callers supply only STRUCTURE
// and never count a character. Every bordered box closes; that invariant holds under recursion (children
// shrink width), columns (width splits + hcat), and database views (table/gallery/board/list).
//
// This file is the thin entry — ONE renderer, render(mockup). It resolves the canvas width, dispatches
// a PageRender, a single Block, or a list of Blocks through the registry, and finishes the lines.

import "./blocks"; // side-effect: registers every block renderer (content · database container · db views)

import type { BlockObject } from "../notion/blocks/block";
import type { DatabaseRender, PageRender } from "../notion/render-bundles";
import { iconGlyph } from "../readers/object";
import { flattenValue, propertyToString, type RawRow, richTextToPlain } from "../readers/page";
import { buildIdToName, type ResolvedView } from "../readers/views";
import type { DatabaseBlock, DatabaseModel } from "./blocks/database/database";
import type { DatabaseView } from "./blocks/database/views/engine";
import type { GalleryCard } from "./blocks/database/views/gallery";
import { type Block, renderBlock, renderBlocks } from "./blocks/engine";
import { renderPage } from "./page";

export { mockupSchema } from "./schema";
export { displayWidth } from "./text";
export type { Block, DatabaseRender, DatabaseView, PageRender };

export type Mockup = PageRender | Block | Block[] | DatabaseRender;

// ── databaseToModel — pure mapper (pre-resolved views + rows → DatabaseModel) ────────────────────

interface DatabaseModelInput {
  title: string;
  icon?: string;
  titleColumn: string;
  views: ResolvedView[];
  rows: RawRow[];
}

const BOARD_CARD_CAP_MODEL = 6;

interface DayComponentsModel {
  year: number;
  month: number;
  day: number;
}

interface DatedRowModel {
  date: DayComponentsModel;
  title: string;
}

function dayOfModel(dateString: string): DayComponentsModel | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
}

function rowTitleModel(row: RawRow, titleColumn: string): string {
  return flattenValue(row.properties?.[titleColumn]) || "(untitled)";
}

function viewToBlock(
  view: ResolvedView,
  rows: RawRow[],
  titleColumn: string,
  dbTitle: string,
  tabs: string[],
): DatabaseView {
  const columns = view.columns.length ? view.columns : [titleColumn];
  const otherColumns = columns.filter((column) => column !== titleColumn);

  switch (view.type) {
    case "gallery":
      return {
        type: "gallery",
        name: dbTitle,
        views: tabs,
        cardSize: "medium",
        cards: rows.map((row) => ({
          name: rowTitleModel(row, titleColumn),
          lines: otherColumns.map((column) => flattenValue(row.properties?.[column])).filter(Boolean),
        })),
      };
    case "board": {
      const groupBy = view.groupBy ?? otherColumns[0] ?? titleColumn;
      const groups = new Map<string, GalleryCard[]>();

      for (const option of view.groupOptions ?? []) {
        groups.set(option, []);
      }
      for (const row of rows) {
        const key = flattenValue(row.properties?.[groupBy]) || "(empty)";
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push({ name: rowTitleModel(row, titleColumn) });
      }
      return {
        type: "board",
        name: dbTitle,
        views: tabs,
        groups: [...groups].map(([name, cards]) => {
          if (cards.length <= BOARD_CARD_CAP_MODEL) {
            return { name, cards };
          }
          return {
            name,
            total: cards.length,
            cards: [...cards.slice(0, BOARD_CARD_CAP_MODEL), { name: `+${cards.length - BOARD_CARD_CAP_MODEL} more` }],
          };
        }),
      };
    }
    case "list":
      return {
        type: "list",
        name: dbTitle,
        views: tabs,
        items: rows.map((row) => ({
          title: rowTitleModel(row, titleColumn),
          meta: otherColumns
            .map((column) => flattenValue(row.properties?.[column]))
            .filter(Boolean)
            .join(" · "),
        })),
      };
    case "calendar": {
      const dateColumn =
        view.dateProperty ??
        columns.find((column) => flattenValue(rows[0]?.properties?.[column]).match(/^\d{4}-\d{2}/));
      const dated = rows
        .map((row) => ({
          date: dayOfModel(flattenValue(row.properties?.[dateColumn ?? ""])),
          title: rowTitleModel(row, titleColumn),
        }))
        .filter((datedRow): datedRow is DatedRowModel => datedRow.date !== null);
      if (dated.length === 0) {
        break; // no usable dates → fall through to table
      }
      const { year, month } = dated[0].date;
      return {
        type: "calendar",
        name: dbTitle,
        views: tabs,
        year,
        month,
        events: dated
          .filter((datedRow) => datedRow.date.year === year && datedRow.date.month === month)
          .map((datedRow) => ({ day: datedRow.date.day, title: datedRow.title })),
      };
    }
    default:
      break;
  }
  return {
    type: "table",
    name: dbTitle,
    views: tabs,
    columns,
    rows: rows.map((row) => columns.map((column) => flattenValue(row.properties?.[column]))),
  };
}

/** Map a database's resolved views + sample rows to a renderable DatabaseModel. Pure. */
export function databaseToModel(input: DatabaseModelInput): DatabaseModel {
  const tabs = input.views.map((view) => view.name);
  const views: DatabaseView[] = input.views.length
    ? input.views.map((view) => viewToBlock(view, input.rows, input.titleColumn, input.title, tabs))
    : [
        {
          type: "table",
          name: input.title,
          columns: [input.titleColumn],
          rows: input.rows.map((row) => [rowTitleModel(row, input.titleColumn)]),
        },
      ];
  return { title: input.title, icon: input.icon, view: 0, views };
}

const DEFAULT_WIDTH = 70;

/** Join rendered lines, collapse runs of 3+ blank lines, and trim the trailing edge — the final mockup string. */
function finish(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** Convert a DatabaseRender (official API shapes) into a DatabaseModel for the internal renderer. */
function renderDatabaseBundle(bundle: DatabaseRender, width: number): string[] {
  const { database, dataSource, views: viewObjects, rows } = bundle;
  // viewIndex may be injected at runtime by read_database (not part of the official DatabaseRender type)
  const viewIndex = (bundle as DatabaseRender & { viewIndex?: number }).viewIndex;

  const title = richTextToPlain(database.title) || "(database)";
  const icon = iconGlyph(database.icon);
  const schema = dataSource.properties ?? {};
  const idToName = buildIdToName(schema);
  const titleColumn =
    Object.entries(schema).find(([, property]) => property.type === "title")?.[0] ?? Object.keys(schema)[0] ?? "Name";

  const BOARD_CARD_CAP = 6;

  interface DayComponents {
    year: number;
    month: number;
    day: number;
  }
  function dayOf(dateString: string): DayComponents | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    return match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
  }

  function rowTitle(row: { properties?: Record<string, unknown> }): string {
    const props = row.properties ?? {};
    const val = props[titleColumn];
    if (!val) {
      return "(untitled)";
    }
    return propertyToString(val as Parameters<typeof propertyToString>[0]) || "(untitled)";
  }

  function flattenVal(row: { properties?: Record<string, unknown> }, col: string): string {
    const prop = row.properties?.[col];
    if (!prop) {
      return "";
    }
    if ((prop as { type?: string }).type === "relation") {
      const relations = (prop as { relation?: { id?: string }[] }).relation ?? [];
      return relations.length ? `${relations.length} linked` : "";
    }
    return propertyToString(prop as Parameters<typeof propertyToString>[0]);
  }

  const tabs = viewObjects.map((view) => view.name ?? "");

  const databaseViews: DatabaseView[] = viewObjects.length
    ? viewObjects.map((viewObj) => {
        const config = viewObj.configuration ?? {};
        const props = config.properties ?? [];
        const columns = props
          .filter((p: { visible?: boolean }) => p.visible !== false)
          .map((p: { property_id?: string }) => idToName[p.property_id ?? ""] ?? p.property_id ?? "")
          .filter((name: string) => Boolean(name));
        const visibleCols = columns.length
          ? [titleColumn, ...columns.filter((c: string) => c !== titleColumn)]
          : [titleColumn];
        const otherCols = visibleCols.filter((c: string) => c !== titleColumn);

        switch (viewObj.type) {
          case "gallery":
            return {
              type: "gallery",
              name: title,
              views: tabs,
              cardSize: "medium",
              cards: rows.map((row) => ({
                name: rowTitle(row),
                lines: otherCols.map((col: string) => flattenVal(row, col)).filter(Boolean),
              })),
            } satisfies DatabaseView;

          case "board": {
            const groupByPropId = (config.group_by as { property_id?: string } | undefined)?.property_id;
            const groupByName = groupByPropId ? (idToName[groupByPropId] ?? groupByPropId) : otherCols[0];
            const groups = new Map<string, GalleryCard[]>();
            const groupProp = groupByName ? schema[groupByName] : undefined;
            const groupPropRecord = groupProp as
              | { status?: { options?: { name?: string }[] }; select?: { options?: { name?: string }[] } }
              | undefined;
            const options = groupPropRecord?.status?.options ?? groupPropRecord?.select?.options ?? [];
            for (const option of options) {
              if (option.name) {
                groups.set(option.name, []);
              }
            }
            for (const row of rows) {
              const key = groupByName ? flattenVal(row, groupByName) || "(empty)" : "(empty)";
              if (!groups.has(key)) {
                groups.set(key, []);
              }
              groups.get(key)?.push({ name: rowTitle(row) });
            }
            return {
              type: "board",
              name: title,
              views: tabs,
              groups: [...groups].map(([name, cards]) => {
                if (cards.length <= BOARD_CARD_CAP) {
                  return { name, cards };
                }
                return {
                  name,
                  total: cards.length,
                  cards: [...cards.slice(0, BOARD_CARD_CAP), { name: `+${cards.length - BOARD_CARD_CAP} more` }],
                };
              }),
            } satisfies DatabaseView;
          }

          case "list":
            return {
              type: "list",
              name: title,
              views: tabs,
              items: rows.map((row) => ({
                title: rowTitle(row),
                meta: otherCols
                  .map((col: string) => flattenVal(row, col))
                  .filter(Boolean)
                  .join(" · "),
              })),
            } satisfies DatabaseView;

          case "calendar": {
            const datePropId = config.date_property_id as string | undefined;
            const dateColName = datePropId ? (idToName[datePropId] ?? datePropId) : otherCols[0];
            interface DatedRow {
              date: DayComponents;
              title: string;
            }
            const dated = rows
              .map((row) => ({
                date: dayOf(dateColName ? flattenVal(row, dateColName) : ""),
                title: rowTitle(row),
              }))
              .filter((r): r is DatedRow => r.date !== null);
            if (dated.length === 0) {
              return {
                type: "table",
                name: title,
                views: tabs,
                columns: visibleCols,
                rows: rows.map((row) => visibleCols.map((col: string) => flattenVal(row, col))),
              } satisfies DatabaseView;
            }
            const { year, month } = dated[0].date;
            return {
              type: "calendar",
              name: title,
              views: tabs,
              year,
              month,
              events: dated
                .filter((r) => r.date.year === year && r.date.month === month)
                .map((r) => ({ day: r.date.day, title: r.title })),
            } satisfies DatabaseView;
          }

          default:
            return {
              type: "table",
              name: title,
              views: tabs,
              columns: visibleCols,
              rows: rows.map((row) => visibleCols.map((col: string) => flattenVal(row, col))),
            } satisfies DatabaseView;
        }
      })
    : [
        {
          type: "table",
          name: title,
          columns: [titleColumn],
          rows: rows.map((row) => [rowTitle(row)]),
        } satisfies DatabaseView,
      ];

  const resolvedViewIndex =
    viewIndex !== undefined && viewIndex >= 0 && viewIndex < databaseViews.length ? viewIndex : 0;
  const model: DatabaseModel = { title, icon, view: resolvedViewIndex, views: databaseViews };
  const databaseBlock: DatabaseBlock = { type: "database", database: model };
  return renderBlock(databaseBlock, width, 0, 0);
}

/**
 * Render a mockup — a PageRender, a single Block, a Block[], or a DatabaseRender — to the finished string.
 * Resolves the canvas width (default DEFAULT_WIDTH) and dispatches through the registry.
 */
export function render(mockup: Mockup, width?: number): string {
  const total = width && width > 0 ? width : DEFAULT_WIDTH;

  if (Array.isArray(mockup)) {
    return finish(renderBlocks(mockup, total, 0));
  }

  if ("page" in mockup && "blocks" in mockup) {
    const bundle = mockup as PageRender;
    return finish(renderPage(bundle.page, bundle.blocks as BlockObject[], total));
  }

  if ("database" in mockup && "dataSource" in mockup) {
    return finish(renderDatabaseBundle(mockup as DatabaseRender, total));
  }

  // Single Block (BlockObject | DatabaseBlock)
  return finish(renderBlock(mockup as Block, total, 0, 0));
}
