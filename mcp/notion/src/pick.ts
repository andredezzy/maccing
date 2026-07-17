// Generic path projection for `request`/`private_request`'s `pick` param — shrinks a large response
// body down to the few fields an agent actually needs. Dot-separated keys walk into objects; a
// trailing `[]` on a segment maps the rest of the path over that array. A path that resolves to
// nothing yields null rather than throwing — a pick is a best-effort projection, not a strict accessor.

/** Project `paths` out of `value` into a flat map keyed by the literal path string. */
export function pickPaths(value: unknown, paths: string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const path of paths) {
    picked[path] = readPath(value, path.split("."));
  }
  return picked;
}

function readPath(value: unknown, segments: string[]): unknown {
  if (segments.length === 0) {
    return value ?? null;
  }
  const [segment, ...rest] = segments;
  const isArrayMap = segment.endsWith("[]");
  const key = isArrayMap ? segment.slice(0, -2) : segment;
  const next = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;

  if (isArrayMap) {
    return Array.isArray(next) ? next.map((item) => readPath(item, rest)) : null;
  }
  return rest.length === 0 ? (next ?? null) : readPath(next, rest);
}
