// Normalize a Notion UUID for the REST API: trim whitespace and lowercase.
// Notion's REST API rejects uppercase UUIDs — a valid-looking uppercase id returns a 404/400.

/** Trim whitespace and lowercase a UUID so it is accepted by the Notion REST API. */
export function normalizeUuid(id: string): string {
  return id.trim().toLowerCase();
}

/** Matches a normalized Notion UUID — 32–36 hex chars with optional hyphens. */
export const UUID_PATTERN = /^[0-9a-f-]{32,36}$/i;
