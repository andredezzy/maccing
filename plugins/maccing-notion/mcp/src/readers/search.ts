// Pure renderer for /v1/search hits — turns Notion's verbose page/data_source objects into one
// compact line each (object · "title" · short id · parent), so name→id lookups cost a few lines
// instead of tens of KB. No API calls.

import { abbreviateId } from "../notion/ids";
import { type RichText, richTextToPlain } from "./page";

interface SearchProperty {
  type?: string;
  title?: RichText[];
}

interface SearchParentRef {
  type?: string;
  page_id?: string;
  data_source_id?: string;
  database_id?: string;
}

export interface RawSearchResult {
  object?: string;
  id?: string;
  title?: RichText[];
  properties?: Record<string, SearchProperty>;
  parent?: SearchParentRef;
}

/** A data source carries `.title`; a page's title lives in its title-type property. */
function titleOf(result: RawSearchResult): string {
  if (result.title?.length) {
    return richTextToPlain(result.title);
  }
  for (const property of Object.values(result.properties ?? {})) {
    if (property.type === "title") {
      return richTextToPlain(property.title) || "(untitled)";
    }
  }
  return "(untitled)";
}

function parentLabel(parent: SearchParentRef | undefined): string {
  if (!parent) {
    return "—";
  }
  switch (parent.type) {
    case "page_id":
      return parent.page_id ? `page ${abbreviateId(parent.page_id)}` : "page";
    case "data_source_id":
      return parent.data_source_id ? `data_source ${abbreviateId(parent.data_source_id)}` : "data_source";
    case "database_id":
      return parent.database_id ? `database ${abbreviateId(parent.database_id)}` : "database";
    default:
      return parent.type ?? "—";
  }
}

/** Render search hits as compact, id-bearing lines plus a count trailer. */
export function formatSearch(results: RawSearchResult[]): string {
  if (results.length === 0) {
    return "# 0 hits — nothing matched";
  }

  const pad = Math.max(...results.map((result) => (result.object ?? "?").length)) + 1;

  const lines = results.map((result) => {
    const object = (result.object ?? "?").padEnd(pad);
    const id = result.id ? abbreviateId(result.id) : "?";
    return `${object} · "${titleOf(result)}" · id ${id} · parent ${parentLabel(result.parent)}`;
  });

  return `${lines.join("\n")}\n# ${results.length} hits`;
}
