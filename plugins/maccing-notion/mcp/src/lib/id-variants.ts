// Shared helper for id-variant expansion — Notion stores property ids in either raw,
// url-decoded, or url-encoded form depending on the endpoint. Comparing variants prevents
// silent misses when the caller holds one form and the map uses another.

/**
 * Try to url-decode a value; return undefined if the value is malformed percent-encoding.
 * Used as a guard predicate so we never silently swallow a URIError.
 */
function tryDecodeURIComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    // Intentional: malformed percent-encoding means the id was not encoded — return undefined.
    return undefined;
  }
}

/**
 * Return the set of forms a Notion property id may appear in across API endpoints.
 *
 * `includeRaw`:
 *   true  — start with the raw id (format-schema.ts caller: `iconFor` has no direct-lookup guard).
 *   false — omit the raw id (format-views.ts caller: `nameFor` guards with a direct lookup before
 *           calling idVariants, so re-including raw would cause a harmless but redundant lookup).
 *
 * Decoded form is pushed only when it differs from the raw id (i.e. the id was encoded).
 * Encoded form is pushed only when it differs from the raw id (i.e. the id was not already encoded).
 */
export function idVariants(id: string, includeRaw: boolean): string[] {
  const variants: string[] = includeRaw ? [id] : [];

  // Decoded form: push only when decoding succeeds AND the result differs from the raw id.
  const decoded = tryDecodeURIComponent(id);
  if (decoded !== undefined && decoded !== id) {
    variants.push(decoded);
  }

  // Encoded form: encodeURIComponent never throws for valid JS strings.
  const encoded = encodeURIComponent(id);
  if (encoded !== id) {
    variants.push(encoded);
  }

  return variants;
}
