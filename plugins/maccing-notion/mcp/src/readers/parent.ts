// A Notion parent reference (the `.parent` on pages / data sources / blocks) and a human-readable label
// for it — shared by `describe`, `search`, and the AGENTS.md parent-chain climb so the cases stay in one place.

import type { ParentRef } from "../notion/parent";

// The loose hand-rolled parent ref is now an ALIAS of the official canon `ParentRef` (src/notion/parent.ts) —
// the canon is the single source of truth. ParentRef is intentionally all-optional, which is exactly what this
// defensive label helper needs (it must render partial refs without throwing).
export type NotionParentRef = ParentRef;

/**
 * "page <id>" | "data_source <id>" | "database <id>" | "block <id>" | the raw type | "—" when absent.
 * Ids are always FULL (never abbreviated) — every id this tool surfaces must be usable as-is.
 */
export function parentLabel(parent: NotionParentRef | undefined): string {
  if (!parent) {
    return "—";
  }
  switch (parent.type) {
    case "page_id":
      return parent.page_id ? `page ${parent.page_id}` : "page";
    case "data_source_id":
      return parent.data_source_id ? `data_source ${parent.data_source_id}` : "data_source";
    case "database_id":
      return parent.database_id ? `database ${parent.database_id}` : "database";
    case "block_id":
      return parent.block_id ? `block ${parent.block_id}` : "block";
    default:
      return parent.type ?? "—";
  }
}
