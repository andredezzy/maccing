// A Notion parent reference (the `.parent` on pages / data sources / blocks) and a human-readable label
// for it — shared by `describe`, `search`, and the AGENTS.md parent-chain climb so the cases stay in one place.

import { abbreviateId } from "../notion/ids";

export interface NotionParentRef {
  type?: string;
  page_id?: string;
  block_id?: string;
  database_id?: string;
  data_source_id?: string;
  workspace?: boolean;
}

/** "page abcd…1234" | "data_source …" | "database …" | "block …" | the raw type | "—" when absent. */
export function parentLabel(parent: NotionParentRef | undefined): string {
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
    case "block_id":
      return parent.block_id ? `block ${abbreviateId(parent.block_id)}` : "block";
    default:
      return parent.type ?? "—";
  }
}
