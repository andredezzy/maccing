// Assemble a LIVE render bundle from the Notion API — the fetch + order + sample step that feeds the
// render_mockup tool. Pure assembly: this layer fetches and shapes the official objects into a PageRender
// or DatabaseRender; it does NOT render (render_mockup renders the returned bundle). The database path is
// faithful to how Notion lays a database out: views in the real tab order, the selected/default view, and
// only the rows that view actually shows (its filter + sorts applied).

import type { BlockObject } from "../notion/blocks/block";
import type { PageObject } from "../notion/page";
import { readViewOrder } from "../notion/private-client";
import { publicRequest } from "../notion/public-client";
import type { DatabaseRender, PageRender } from "../notion/render-bundles";
import type { NotionIcon } from "./object";
import { databaseToDataSourceId, type PropertiesMap } from "./schema";
import { fetchViews, orderViews, selectViewIndex, viewQueryFilter } from "./views";

/** Rows sampled for a database mockup — one past this is fetched to flag "there are more". */
export const SAMPLE_CAP = 24;

interface ChildrenResponse {
  results?: BlockObject[];
  has_more?: boolean;
  next_cursor?: string | null;
}

/** Fetch a page's block tree, recursing into has_children blocks up to `depth`, nesting children in the payload. */
async function fetchBlockTree(id: string, depth: number): Promise<BlockObject[]> {
  const out: BlockObject[] = [];
  let cursor: string | undefined;
  do {
    const query: Record<string, unknown> = { page_size: 100 };
    if (cursor) {
      query.start_cursor = cursor;
    }
    const response = await publicRequest("GET", `/v1/blocks/${id}/children`, undefined, query);
    if (!response.ok) {
      break;
    }
    const body = response.body as ChildrenResponse;
    for (const block of body.results ?? []) {
      if (block.has_children && depth > 0 && block.id) {
        const children = await fetchBlockTree(block.id, depth - 1);
        if (children.length > 0) {
          const payload = (block as Record<string, unknown>)[block.type] as Record<string, unknown>;
          if (payload && typeof payload === "object") {
            payload.children = children;
          }
        }
      }
      out.push(block);
    }
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/** Fetch a live page object + its block tree as a PageRender, or null if the page can't be read. */
export async function fetchPageRender(pageId: string, depth: number): Promise<PageRender | null> {
  const [pageResponse, blocks] = await Promise.all([
    publicRequest("GET", `/v1/pages/${pageId}`),
    fetchBlockTree(pageId, depth),
  ]);
  if (!pageResponse.ok) {
    return null;
  }
  return { page: pageResponse.body as PageObject, blocks };
}

interface DatabaseTitleBody {
  title?: { plain_text?: string }[];
  icon?: NotionIcon | null;
}

interface DataSourceSchema {
  properties?: PropertiesMap;
}

interface QueryResponse {
  results?: PageObject[];
}

export interface LiveDatabaseRender {
  bundle: DatabaseRender;
  selectedIndex: number;
  truncated: boolean;
}

/** Fetch a live database as a DatabaseRender bundle + the selected view index, or null if unreadable. */
export async function fetchDatabaseRender(
  databaseId: string,
  viewSelector: string | number | undefined,
): Promise<LiveDatabaseRender | null> {
  const dataSourceId = (await databaseToDataSourceId(databaseId)) ?? databaseId;

  const schemaResponse = await publicRequest("GET", `/v1/data_sources/${dataSourceId}`);
  if (!schemaResponse.ok) {
    return null;
  }
  const schema = (schemaResponse.body as DataSourceSchema).properties ?? {};

  // Title + icon live on the DATABASE WRAPPER. `databaseId` may be a data_source_id (the public /databases
  // endpoint only accepts a database id, so that GET 404s) — when it does, resolve the wrapper via the data
  // source's parent so the header shows the real title/icon regardless of which id was passed.
  let dbResponse = await publicRequest("GET", `/v1/databases/${databaseId}`);
  if (!dbResponse.ok) {
    const parentDatabaseId = (schemaResponse.body as { parent?: { database_id?: string } }).parent?.database_id;
    if (parentDatabaseId) {
      dbResponse = await publicRequest("GET", `/v1/databases/${parentDatabaseId}`);
    }
  }

  // Order views the way Notion shows them. The public API exposes no tab order or default-view signal, so we
  // read the container block's `view_ids` via private api/v3 (databaseId IS the collection_view block id);
  // that order also excludes views belonging to OTHER linked-DB containers sharing this data source. Falls
  // back to public order if token_v2 is absent. `viewSelector` picks which view to render.
  const rawViews = await fetchViews(dataSourceId);
  const ordered = orderViews(rawViews, await readViewOrder(databaseId), databaseId);
  const selectedIndex = selectViewIndex(ordered, viewSelector);

  // Sample the rows the SELECTED view actually shows — apply its filter + sorts so the mockup matches the
  // live view (a board's filtered-out rows must NOT appear). Cap the preview; fetch one past it to flag
  // "there are more". A filter Notion rejects → unfiltered fallback.
  const selected = ordered[selectedIndex];
  const filter = selected ? viewQueryFilter(selected) : undefined;
  const sorts = selected?.sorts ?? undefined;
  const queryBody: Record<string, unknown> = { page_size: SAMPLE_CAP + 1 };
  if (filter) {
    queryBody.filter = filter;
  }
  if (sorts) {
    queryBody.sorts = sorts;
  }
  let query = await publicRequest("POST", `/v1/data_sources/${dataSourceId}/query`, queryBody);
  if (!query.ok && (filter || sorts)) {
    query = await publicRequest("POST", `/v1/data_sources/${dataSourceId}/query`, { page_size: SAMPLE_CAP + 1 });
  }
  const fetched = query.ok ? ((query.body as QueryResponse).results ?? []) : [];
  const truncated = fetched.length > SAMPLE_CAP;
  const rows = truncated ? fetched.slice(0, SAMPLE_CAP) : fetched;

  const database = dbResponse.ok ? (dbResponse.body as DatabaseTitleBody) : {};
  // The reader layer still uses loose API-response types; the bundle is the exact DatabaseRender shape and
  // the renderer reads it defensively.
  const bundle = { database, dataSource: { properties: schema }, views: ordered, rows } as unknown as DatabaseRender;
  return { bundle, selectedIndex, truncated };
}
