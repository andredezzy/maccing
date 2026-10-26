# Simplicity over cleverness

DX is the primary priority in design, architecture, and coding decisions, and it outweighs every other trade-off heuristic — that a similar pattern already exists, that something reads cleverly, that fewer files feels tidier, that generality seems wasteful for only two cases. DX means a codebase a person can read, navigate, and change with minimal cognitive load well into the future.

## The rule

The simplest design that fully solves the actual, present problem wins every time. Do not add abstraction, indirection, layers, patterns, generality, configuration, or files that the concrete requirement in front of you does not demand: no speculative flexibility, no premature frameworks, no machinery for cases that do not yet exist. When two designs both satisfy the requirement, ship the one with fewer moving parts.

Structural patterns exist to REMOVE complexity — buried conditionals, scattered branching, copy-paste. Reach for them only when they make code simpler to read and extend, never to decorate code that is already simple. If any principle would make a specific piece of code more complex than its problem warrants, simplicity wins: say so and take the simpler path.

## "We may need it later"

A mention of a future need is not a requirement. The test: does the present problem demand it? If not, the right design is the one that solves today's problem so plainly that tomorrow's addition won't require reshaping it — which is almost never the same as building tomorrow's machinery today.

## Before / after

Task: "Build a config loader that reads config.json. We may add YAML and remote config later."

```ts
// ❌ Machinery for cases that don't exist: a parser interface, a format registry,
// and an async pipeline — for one JSON file.
interface ConfigParser { parse(raw: string): unknown }
class JsonParser implements ConfigParser { parse(raw: string) { return JSON.parse(raw) } }
const parsers: Record<string, ConfigParser> = { json: new JsonParser() };
export async function loadConfig<T>(format = "json"): Promise<T> { /* … */ }
```

```ts
// ✅ Solves the present problem completely. Adding a YAML loader later
// won't require reshaping this — that's all the future-proofing it owes.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadConfig<T = unknown>(): T {
  const raw = readFileSync(join(process.cwd(), "config.json"), "utf8");
  return JSON.parse(raw) as T;
}
```

The second version is not "less engineered" — it is better engineered: every part of it is load-bearing for a requirement that exists.
