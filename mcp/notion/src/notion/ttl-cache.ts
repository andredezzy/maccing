interface TtlCacheOptions {
  /** How long an entry stays fresh. Zero disables caching entirely. */
  ttlMs: number;
  /** Hard cap on retained entries; the oldest insertion is evicted first. */
  maxEntries: number;
  /** Injectable clock, for tests that need to cross the TTL boundary. */
  clock?: () => number;
}

interface Entry<T> {
  expiresAt: number;
  /** The in-flight or settled compute. Sharing the promise — rather than its
   *  resolved value — is what collapses a concurrent stampede into one call. */
  value: Promise<T>;
}

/**
 * A small TTL cache for reads that are stable within a task but must not go
 * stale across tasks.
 *
 * Sized for one specific shape of waste: an agent re-reading the same immutable
 * thing several times inside a single run, where each read costs a network
 * round-trip. It is deliberately not a general cache — no tiering, no
 * revalidation, no persistence. A short TTL is the entire staleness policy, so
 * a value edited elsewhere is picked up within that window rather than pinned
 * for the life of the process.
 */
export class TtlCache<T> {
  readonly #entries = new Map<string, Entry<T>>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;

  constructor({ ttlMs, maxEntries, clock = Date.now }: TtlCacheOptions) {
    this.#ttlMs = Math.max(0, ttlMs);
    this.#maxEntries = Math.max(1, maxEntries);
    this.#now = clock;
  }

  /** Return the cached value for `key`, computing it when absent or expired. */
  async resolve(key: string, compute: () => Promise<T>): Promise<T> {
    if (this.#ttlMs === 0) {
      return compute();
    }

    const hit = this.#entries.get(key);
    if (hit && hit.expiresAt > this.#now()) {
      return hit.value;
    }

    const value = compute();
    this.#entries.set(key, { expiresAt: this.#now() + this.#ttlMs, value });

    // A failed compute must not be served to later callers, and must not leave
    // a poisoned key behind. Drop it on rejection, but only if this exact entry
    // is still the one parked under the key.
    value.catch(() => {
      if (this.#entries.get(key)?.value === value) {
        this.#entries.delete(key);
      }
    });

    this.#evictOverflow();
    return value;
  }

  /** Drop every entry. Exists for tests that need a cold cache between cases;
   *  production relies on the TTL, never on manual invalidation. */
  clear(): void {
    this.#entries.clear();
  }

  /** Map preserves insertion order, so the first key is the oldest. */
  #evictOverflow(): void {
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (oldest.done) {
        return;
      }
      this.#entries.delete(oldest.value);
    }
  }
}
