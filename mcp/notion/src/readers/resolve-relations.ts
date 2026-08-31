// Resolve Notion relation target ids → human-readable title strings, so agents never see bare uuids.
// Batched, deduped, and cached. Distinguishes 429 (rate limit → throw, caller retries) from 404/403 (→ "[deleted]").

import { TtlCache } from "../notion/ttl-cache";
import { publicRequest } from "../notion/public-client";
import { type NotionPageBase, titleOf } from "./page";

const PAGE_FETCH_BATCH_SIZE = 20; // concurrent GET /v1/pages — conservative vs the 180 req/min general limit

// How long a resolved title stays fresh.
//
// Relation targets are the stable half of a database: a training log names the
// same exercises every week, a task board the same projects. Measured on a real
// read, resolving them was 19.2s of a 21.6s call — one GET per target, every
// time, for names that had not changed in weeks.
//
// Ten minutes spans a working session. A rename landing mid-window shows the old
// title on one read; the cost it removes is paid on every row of every read.
const TITLE_TTL_MS = 10 * 60_000;
// One entry per relation target. A log with a few hundred distinct targets is
// the realistic ceiling; the bound stops a long session growing without limit.
const TITLE_CACHE_MAX_ENTRIES = 512;

const titleCache = new TtlCache<string>({
  ttlMs: TITLE_TTL_MS,
  maxEntries: TITLE_CACHE_MAX_ENTRIES,
});

/** Drop every cached title. Tests only — production relies on the TTL. */
export function __resetRelationTitleCache(): void {
  titleCache.clear();
}

/** A target that could not be read right now. Thrown rather than returned so
 *  `TtlCache` drops the rejection: a 404 is a fact about this moment, not about
 *  the id, and a later share or restore must not be masked by a cached miss. */
class UnreadableTarget extends Error {}

async function fetchTitle(id: string): Promise<string> {
  const response = await publicRequest("GET", `/v1/pages/${id}`);

  if (response.status === 429) {
    throw new Error("Notion rate limit (429) while resolving relations — retry.");
  }

  if (!response.ok) {
    throw new UnreadableTarget("[deleted]"); // 404/403 — target gone or not shared
  }

  return titleOf(response.body as NotionPageBase);
}

/** Map each unique relation target id to its page title. Throws on a 429 so the caller can back off. */
export async function resolveRelations(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const resolved = new Map<string, string>();

  for (let offset = 0; offset < unique.length; offset += PAGE_FETCH_BATCH_SIZE) {
    const slice = unique.slice(offset, offset + PAGE_FETCH_BATCH_SIZE);
    const pairs = await Promise.all(
      slice.map(async (id): Promise<[string, string]> => {
        try {
          return [id, await titleCache.resolve(id, () => fetchTitle(id))];
        } catch (error) {
          if (error instanceof UnreadableTarget) {
            return [id, error.message];
          }

          throw error;
        }
      }),
    );
    for (const [id, title] of pairs) {
      resolved.set(id, title);
    }
  }

  return resolved;
}
