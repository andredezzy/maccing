// Architecture invariant: the RUNTIME module import graph must stay ACYCLIC (CLAUDE.md: no circular imports —
// extract a shared dep into a third module instead). `import type` / `export type` statements are EXCLUDED:
// they erase at compile time, form no runtime edge, and so cannot cause the init-order / shared-instance
// cycles this rule targets — which lets a recursive type union (Block / DatabaseView) legitimately reference its
// members across the renderer files that own them. This builds the graph from the actual runtime `from "./…"`
// imports across src/ and fails with the offending chain if any cycle appears. Run with `bun test`.

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { Glob } from "bun";

const SRC = import.meta.dir;

/** Resolve a relative import specifier to the source file it points at (`.ts` or a dir `index.ts`). */
function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) {
    return null; // external package — not part of our graph
  }
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

test("the src/ import graph is acyclic (no module cycles)", async () => {
  const files = [...new Glob("**/*.ts").scanSync(SRC)]
    .filter((relativePath) => !relativePath.endsWith(".test.ts"))
    .map((relativePath) => `${SRC}/${relativePath}`);

  const graph = new Map<string, string[]>();
  for (const file of files) {
    const source = await Bun.file(file).text();
    // Only RUNTIME imports are real edges. A leading `type` keyword (`import type …` / `export type …`) marks a
    // fully type-only statement that erases at compile time — skip it. Mixed imports (`import { type X, foo }`)
    // keep their edge via the runtime binding `foo`.
    const fromImports = [...source.matchAll(/(?:import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g)]
      .filter((match) => !match[1])
      .map((match) => match[2]);
    const sideEffectImports = [...source.matchAll(/^import\s+["']([^"']+)["'];?\s*$/gm)].map((match) => match[1]);
    const deps = [...fromImports, ...sideEffectImports]
      .map((spec) => resolveImport(file, spec))
      .filter((dep): dep is string => dep !== null);
    graph.set(file, [...new Set(deps)]);
  }

  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[] = [];

  const visit = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        const start = stack.indexOf(next);
        cycles.push([...stack.slice(start), next].map((path) => relative(SRC, path)).join(" → "));
      } else if (!color.get(next)) {
        visit(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };
  for (const file of files) {
    if (!color.get(file)) {
      visit(file);
    }
  }

  expect(cycles).toEqual([]);
});
