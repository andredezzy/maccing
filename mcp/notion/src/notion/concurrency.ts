/**
 * Run an async mapper over `items` with at most `limit` in flight.
 *
 * Notion's API rate-limits per integration, so fanning a whole ancestry out
 * with `Promise.all` trades a queue of requests for a burst of 429s — the
 * client retries them, and the wall-clock win evaporates. A small fixed window
 * keeps the pipe full without tripping the limiter.
 *
 * Results come back in input order regardless of completion order, so callers
 * can zip them against the input.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  // A caller computing the limit from config can hand us 0 or NaN; one worker
  // is slow but correct, whereas zero workers would return an array of holes.
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let next = 0;

  async function work(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: workers }, work));
  return results;
}
