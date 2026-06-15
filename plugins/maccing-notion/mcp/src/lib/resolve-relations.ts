// Resolve Notion relation target ids → human-readable title strings, so agents never see bare uuids.
// Batched + deduped. Distinguishes 429 (rate limit → throw, caller retries) from 404/403 (→ "[deleted]").

import { publicRequest } from "../notion/public-client";
import { type NotionPageBase, titleOf } from "./notion-page";

const PAGE_FETCH_BATCH_SIZE = 20; // concurrent GET /v1/pages — conservative vs the 180 req/min general limit

/** Map each unique relation target id to its page title. Throws on a 429 so the caller can back off. */
export async function resolveRelations(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const resolved = new Map<string, string>();

  for (let offset = 0; offset < unique.length; offset += PAGE_FETCH_BATCH_SIZE) {
    const slice = unique.slice(offset, offset + PAGE_FETCH_BATCH_SIZE);
    const pairs = await Promise.all(
      slice.map(async (id): Promise<[string, string]> => {
        const response = await publicRequest("GET", `/v1/pages/${id}`);
        if (response.status === 429) {
          throw new Error("Notion rate limit (429) while resolving relations — retry.");
        }
        if (!response.ok) {
          return [id, "[deleted]"]; // 404/403 — target gone or not shared
        }
        return [id, titleOf(response.body as NotionPageBase)];
      }),
    );
    for (const [id, title] of pairs) {
      resolved.set(id, title);
    }
  }

  return resolved;
}
