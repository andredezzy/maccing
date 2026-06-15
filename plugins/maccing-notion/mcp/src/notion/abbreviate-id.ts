/** Abbreviate a Notion id for display: keep first 8 + last 4 characters, separated by an ellipsis.
 * Returns the id as-is when it is 12 characters or shorter (no abbreviation needed). */
export function abbreviateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
