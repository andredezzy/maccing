// Pure renderer for /v1/search hits — turns Notion's verbose page/data_source objects into one
// compact line each (object · "title" · short id · parent), so name→id lookups cost a few lines
// instead of tens of KB. No API calls.

interface RichText {
  plain_text?: string;
}

interface SearchProperty {
  type?: string;
  title?: RichText[];
}

export interface RawSearchResult {
  object?: string;
  id?: string;
  title?: RichText[];
  properties?: Record<string, SearchProperty>;
  parent?: { type?: string; page_id?: string; data_source_id?: string; database_id?: string };
}

const short = (id: string): string => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

const plain = (rich: RichText[] | undefined): string => (rich ?? []).map((part) => part.plain_text ?? "").join("");

/** A data source carries `.title`; a page's title lives in its title-type property. */
function titleOf(result: RawSearchResult): string {
  if (result.title?.length) {
    return plain(result.title);
  }
  for (const property of Object.values(result.properties ?? {})) {
    if (property.type === "title") {
      return plain(property.title) || "(untitled)";
    }
  }
  return "(untitled)";
}

function parentOf(parent: RawSearchResult["parent"]): string {
  if (!parent) {
    return "—";
  }
  switch (parent.type) {
    case "page_id":
      return parent.page_id ? `page ${short(parent.page_id)}` : "page";
    case "data_source_id":
      return parent.data_source_id ? `data_source ${short(parent.data_source_id)}` : "data_source";
    case "database_id":
      return parent.database_id ? `database ${short(parent.database_id)}` : "database";
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
    const id = result.id ? short(result.id) : "?";
    return `${object} · "${titleOf(result)}" · id ${id} · parent ${parentOf(result.parent)}`;
  });

  return `${lines.join("\n")}\n# ${results.length} hits`;
}
