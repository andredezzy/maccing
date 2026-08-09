import { make_key, type PhoneFormat } from "./phone.ts";

/**
 * The map reader, and the shape of what it reads.
 *
 * Four roles are the whole vocabulary: a `person`, `revenue` arriving, `churn` leaving, a
 * `conversion` committing. Nothing here names a product, a market or a country. Which tables and
 * columns fill those roles is the map's business, and the map lives in the project rather than in
 * this package — that separation is what lets one engine measure projects that share no domain.
 *
 * The map itself is a markdown file a person reads and a parser reads, and most of it is neither
 * section nor table: it is the prose explaining why a join goes through one table rather than
 * another, and why one status means money actually arrived. That prose is the half of the document
 * that keeps the bindings honest, so the format puts it first and the parser ignores it entirely,
 * reading only the pipe tables under headings it knows.
 *
 * Two rules here are stricter than markdown would need, and both come from the same failure. An
 * unknown key inside a table is an error rather than a warning, because a mistyped key parses as
 * silence and a binding goes missing with nothing to notice it. And a fenced block is skipped
 * outright, so an example table inside a code fence never reads as the real one.
 */

/** Which file and which columns carry a role. `at_fallback` covers a nullable timestamp. */
export type RoleBinding = {
  export: string;
  columns: Record<string, string>;
  /** Only on the conversion role: statuses that count as committed. */
  valid_statuses?: readonly string[];
  /** Only on the conversion role, and optional there: the value of the `split` column meaning
   *  recycled rather than new. It travels with `columns.split` — both are declared or neither is,
   *  and the pair being absent says the product has no recycled-balance concept to split on, not
   *  that it has one measuring zero. Forcing every project to name a split would make it invent
   *  a distinction its product does not have. */
  recycled_when?: string;
};

export type DatabaseMap = {
  phone: PhoneFormat;
  person: RoleBinding;
  conversion: RoleBinding;
  /** Absent in a project with nothing to collect. The record omits the role rather than
   *  reporting it as zero, because unbound and empty are different facts. */
  revenue?: RoleBinding;
  churn?: RoleBinding;
  /** `models` names the schema blocks the hash covers. A block is a `model` or an `enum`: the
   *  statuses a map counts as committed and the value marking recycled money are enum values, and
   *  a rename there changes what every binding means while leaving every model untouched. */
  fingerprint: { schema: string; models: readonly string[]; sha256: string };
};

const SECTION_PHONE = "## Phone format";
const SECTION_FINGERPRINT = "## Fingerprint";
const SECTION_PERSON = "## Role: person";
const SECTION_REVENUE = "## Role: revenue";
const SECTION_CHURN = "## Role: churn";
const SECTION_CONVERSION = "## Role: conversion";

/** No map at the path given, or a map naming a schema file that is not there. */
export class MapMissingError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path} is not there. ${reason}`);
    this.name = "MapMissingError";
    this.path = path;
  }
}

/** A section the map must carry is absent, or a block it names cannot be found. */
export class MapSectionError extends Error {
  readonly section: string;

  constructor(section: string, reason: string) {
    super(`${section}: ${reason}`);
    this.name = "MapSectionError";
    this.section = section;
  }
}

/** A key inside a read table is missing, unreadable, or not one the section defines. */
export class MapFieldError extends Error {
  readonly section: string;
  readonly key: string;

  constructor(section: string, key: string, reason: string) {
    super(`${section} · ${key}: ${reason}`);
    this.name = "MapFieldError";
    this.section = section;
    this.key = key;
  }
}

/**
 * Two roles bound to one export through the same columns.
 *
 * Revenue and churn are opposite directions, so a row cannot be both. Bound identically they are
 * not two roles at all: the same file is opened twice, the same rows are indexed twice, and the
 * record publishes churn as an exact copy of revenue — money arriving and the same money leaving,
 * from the same people at the same instants. Nothing downstream can tell that from a project
 * where inflow and outflow really did match to the cent.
 *
 * The guard is deliberately narrow: all four of the export and the three columns have to match.
 * A shared export with any one column different has an honest reading and is left alone — a
 * monthly statement per member carrying `deposited` and `withdrew` differs in the amount column,
 * a position table carrying `opened_at` and `closed_at` against one amount differs in the
 * timestamp, and a transfer table read from `payer` on one side and `payee` on the other differs
 * in the person. Only the identical quadruple has no reading, which is why it is the whole test.
 */
export class MapDuplicateBindingError extends Error {
  readonly roles: readonly [string, string];
  readonly export: string;

  constructor(roles: readonly [string, string], binding: RoleBinding) {
    super(
      `${roles[0]} and ${roles[1]} both bind ${binding.export} through the same person, at and ` +
        `amount columns (${binding.columns.person}, ${binding.columns.at}, ${binding.columns.amount}). ` +
        "Money arriving and money leaving are not the same rows, so one of the two is pointing at " +
        "the wrong file — usually because the second section was written by copying the first and " +
        "changing only the heading. Bind it to the export that holds it, or delete the section if " +
        "this project has no file for that role: an unbound role is omitted from the record, which " +
        "is the truthful answer and not the same as reporting zero.",
    );
    this.name = "MapDuplicateBindingError";
    this.roles = roles;
    this.export = binding.export;
  }
}

/** The schema moved under the map. Thrown by the caller that checks, never swallowed: a map
 *  describing a shape the database no longer has produces columns that read as empty. */
export class MapStaleError extends Error {
  readonly schema: string;
  readonly expected: string;
  readonly actual: string;

  constructor(schema: string, expected: string, actual: string) {
    super(
      `${schema} has changed since the map was written. Recorded sha256 ${expected}, current ${actual}. ` +
        "Re-read the changed blocks, correct any binding they invalidate, then record the new hash.",
    );
    this.name = "MapStaleError";
    this.schema = schema;
    this.expected = expected;
    this.actual = actual;
  }
}

/** One read table: key to raw value, in declaration order. */
type Table = Map<string, string>;

/**
 * Split the document into the lines under each `##` heading, dropping everything inside a fenced
 * block. Fences are matched by length, so a fence demonstrating another fence closes correctly.
 *
 * A heading declared twice is refused rather than merged or overwritten. Two `## Role: person`
 * sections is what a map edited by two people, or copied from another project and half-adjusted,
 * looks like; the second silently wins, so the bindings a reader sees at the top of the file are
 * not the ones the run uses, and every column in between reads as correct while pointing at the
 * wrong table.
 */
function split_sections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  let fence = 0;

  for (const line of text.split("\n")) {
    const ticks = /^\s*(`{3,})/.exec(line);
    if (ticks !== null) {
      const width = (ticks[1] as string).length;
      if (fence === 0) {
        fence = width;
      } else if (width >= fence) {
        fence = 0;
      }
      continue;
    }
    if (fence !== 0) {
      continue;
    }

    const heading = /^##(?!#)\s*(.+?)\s*$/.exec(line);
    if (heading !== null) {
      const name = `## ${heading[1] as string}`;
      if (sections.has(name)) {
        throw new MapSectionError(
          name,
          "declared twice in this map. The later one silently replaces the earlier, so the binding " +
            "a reader checks is not the binding the run uses. Merge the two into one section, or " +
            "rename whichever of them describes something else",
        );
      }
      current = [];
      sections.set(name, current);
      continue;
    }
    if (current !== null) {
      current.push(line);
    }
  }
  return sections;
}

/** Cells of a markdown pipe row, or null where the line is not one. */
function cells_of(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return null;
  }
  const inner = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined);
  return inner.split("|").map((cell) => cell.trim());
}

/** The first `| field | value |` table under a heading, or null when the section has none. */
function read_table_of(lines: string[], heading: string): Table | null {
  for (let i = 0; i < lines.length; i++) {
    const header = cells_of(lines[i] as string);
    if (header === null || header.length !== 2) {
      continue;
    }
    if (header[0]?.toLowerCase() !== "field" || header[1]?.toLowerCase() !== "value") {
      continue;
    }

    const table: Table = new Map();
    for (let r = i + 1; r < lines.length; r++) {
      const row = cells_of(lines[r] as string);
      if (row === null) {
        break;
      }
      const key = row[0] as string;
      // The alignment row carries no data; every cell is dashes and colons.
      if (/^:?-{1,}:?$/.test(key)) {
        continue;
      }
      // A key written twice is refused rather than resolved, for the reason the duplicate-heading
      // guard one level up already gives: a `Map` keeps the last write, and the reader looking at
      // the document sees the first. So the binding that runs is the one nobody read. Measured
      // before this refused: an `at` declared as `signed_at` and then again as `row_created_at`
      // published `conversions {count: 0, value: 0}` where the visible first binding gives
      // `{count: 1, value: 500}` — no error, and a row of zeros is this engine's cheapest wrong
      // answer. Editing a map by copying a line and forgetting to change its key is how it arrives.
      if (table.has(key)) {
        throw new MapFieldError(
          heading,
          key,
          "declared twice in this table. Only the second row would be read, while a person reading " +
            "the document sees the first, so the binding that runs is the one nobody checked. " +
            "Delete the row that does not belong.",
        );
      }
      table.set(key, row.slice(1).join("|").trim());
    }
    return table;
  }
  return null;
}

function section_table(sections: Map<string, string[]>, heading: string): Table {
  const lines = sections.get(heading);
  if (lines === undefined) {
    throw new MapSectionError(heading, "the map does not declare this section, and it is required");
  }
  const table = read_table_of(lines, heading);
  if (table === null) {
    throw new MapSectionError(heading, "no `| field | value |` table under this heading — only prose");
  }
  return table;
}

/** Read and consume a key. What is left in the table afterwards is by definition unknown. */
function take(table: Table, section: string, key: string): string {
  const value = table.get(key);
  if (value === undefined) {
    throw new MapFieldError(section, key, "required, and the section does not declare it");
  }
  table.delete(key);
  return value;
}

function take_number(table: Table, section: string, key: string, whole: boolean): number {
  const raw = take(table, section, key);
  const value = Number(raw);
  const acceptable = whole ? Number.isInteger(value) : Number.isFinite(value);
  if (raw.trim() === "" || !acceptable) {
    throw new MapFieldError(
      section,
      key,
      `expected ${whole ? "a whole number" : "a number"}, got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

function reject_unknown(table: Table, section: string): void {
  const [unknown] = table.keys();
  if (unknown === undefined) {
    return;
  }
  throw new MapFieldError(
    section,
    unknown,
    "not a key this section defines. A typo that parses as silence is how a binding goes missing with nothing to notice it",
  );
}

/** Revenue and churn bind identically; only which events they hold differs. */
function event_role(sections: Map<string, string[]>, heading: string): RoleBinding | undefined {
  if (!sections.has(heading)) {
    return undefined;
  }
  const table = section_table(sections, heading);
  const binding: RoleBinding = {
    export: take(table, heading, "export"),
    columns: {
      person: take(table, heading, "person"),
      at: take(table, heading, "at"),
      amount: take(table, heading, "amount"),
    },
  };
  reject_unknown(table, heading);
  return binding;
}

/**
 * Read a map. Structure only: this never opens the schema file, so a map naming one that has moved
 * still parses and the drift check stays a separate, reportable failure rather than a parse error.
 */
export async function load_map(path: string): Promise<DatabaseMap> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new MapMissingError(
      path,
      "Measuring without a map means guessing which column holds what, and a guess that parses " +
        "produces numbers nobody can trace back to a table.",
    );
  }
  const sections = split_sections(await file.text());

  const phone_table = section_table(sections, SECTION_PHONE);
  const phone: PhoneFormat = {
    country_code: take(phone_table, SECTION_PHONE, "country_code"),
    area_digits: take_number(phone_table, SECTION_PHONE, "area_digits", true),
    subscriber_digits: take_number(phone_table, SECTION_PHONE, "subscriber_digits", true),
    max_unparseable_rate: take_number(phone_table, SECTION_PHONE, "max_unparseable_rate", false),
    shared_account_ceiling: take_number(phone_table, SECTION_PHONE, "shared_account_ceiling", true),
  };
  const area_codes = phone_table.get("area_codes");
  if (area_codes !== undefined) {
    phone_table.delete("area_codes");
    phone.area_codes = area_codes
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code !== "");
  }
  reject_unknown(phone_table, SECTION_PHONE);
  // Building the deriver validates the format once, here, where the failure can still name the
  // map instead of surfacing as an index that matches nothing.
  make_key(phone);

  const fingerprint_table = section_table(sections, SECTION_FINGERPRINT);
  const fingerprint = {
    schema: take(fingerprint_table, SECTION_FINGERPRINT, "schema"),
    models: take(fingerprint_table, SECTION_FINGERPRINT, "models")
      .split(",")
      .map((model) => model.trim())
      .filter((model) => model !== ""),
    sha256: take(fingerprint_table, SECTION_FINGERPRINT, "sha256"),
  };
  reject_unknown(fingerprint_table, SECTION_FINGERPRINT);
  if (fingerprint.models.length === 0) {
    throw new MapFieldError(SECTION_FINGERPRINT, "models", "lists no blocks, so the hash would cover nothing");
  }

  const person_table = section_table(sections, SECTION_PERSON);
  const person: RoleBinding = {
    export: take(person_table, SECTION_PERSON, "export"),
    columns: {
      id: take(person_table, SECTION_PERSON, "id"),
      phone: take(person_table, SECTION_PERSON, "phone"),
      created_at: take(person_table, SECTION_PERSON, "created_at"),
    },
  };
  reject_unknown(person_table, SECTION_PERSON);

  const conversion_table = section_table(sections, SECTION_CONVERSION);
  const conversion: RoleBinding = {
    export: take(conversion_table, SECTION_CONVERSION, "export"),
    columns: {
      person: take(conversion_table, SECTION_CONVERSION, "person"),
      at: take(conversion_table, SECTION_CONVERSION, "at"),
      amount: take(conversion_table, SECTION_CONVERSION, "amount"),
      status: take(conversion_table, SECTION_CONVERSION, "status"),
    },
    valid_statuses: take(conversion_table, SECTION_CONVERSION, "valid_statuses")
      .split(",")
      .map((status) => status.trim())
      .filter((status) => status !== ""),
  };
  const at_fallback = conversion_table.get("at_fallback");
  if (at_fallback !== undefined) {
    conversion_table.delete("at_fallback");
    conversion.columns.at_fallback = at_fallback;
  }
  // The split is optional, and the two keys that express it are one declaration. A project whose
  // product has no recycled balance leaves both out and the record omits the breakdown rather
  // than reporting zeros for a distinction that does not exist. Half of it is neither: it is a
  // binding somebody started and stopped, and reading it as "no split" would silently drop a
  // distinction the map says exists.
  const split = conversion_table.get("split");
  const recycled_when = conversion_table.get("recycled_when");
  conversion_table.delete("split");
  conversion_table.delete("recycled_when");
  if (split !== undefined && recycled_when === undefined) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "recycled_when",
      "missing while `split` is declared. The two are declared together or not at all: a split " +
        "column with no value marking the recycled side cannot be read, and treating the pair as " +
        "absent would drop a distinction this map says the product has",
    );
  }
  if (recycled_when !== undefined && split === undefined) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "split",
      "missing while `recycled_when` is declared. The two are declared together or not at all: a " +
        "value marking the recycled side names no column to read it from, and treating the pair " +
        "as absent would drop a distinction this map says the product has",
    );
  }
  if (split !== undefined && recycled_when !== undefined) {
    conversion.columns.split = split;
    conversion.recycled_when = recycled_when;
  }
  reject_unknown(conversion_table, SECTION_CONVERSION);
  if (conversion.valid_statuses?.length === 0) {
    throw new MapFieldError(
      SECTION_CONVERSION,
      "valid_statuses",
      "names no status, so nothing would ever count as committed and every cell would report zero",
    );
  }

  const map: DatabaseMap = { phone, person, conversion, fingerprint };
  const revenue = event_role(sections, SECTION_REVENUE);
  const churn = event_role(sections, SECTION_CHURN);
  // Both bindings are in hand here and nowhere later: by the time the indices are built the two
  // roles have been separated into two arguments and the reader that could compare them is gone.
  if (
    revenue !== undefined &&
    churn !== undefined &&
    revenue.export === churn.export &&
    revenue.columns.person === churn.columns.person &&
    revenue.columns.at === churn.columns.at &&
    revenue.columns.amount === churn.columns.amount
  ) {
    throw new MapDuplicateBindingError([SECTION_REVENUE, SECTION_CHURN], revenue);
  }
  if (revenue !== undefined) {
    map.revenue = revenue;
  }
  if (churn !== undefined) {
    map.churn = churn;
  }
  return map;
}

/**
 * Hash the schema blocks the map claims to describe and compare against the hash it recorded.
 *
 * The schema path is resolved against the map's own directory, not against a configured root. A
 * map that has to be told where the repository starts is a map that needs configuration to guard
 * anything, and a guard nobody configures is a guard nobody runs. The map already knows where its
 * schema is; that is the only fact needed.
 *
 * Reports rather than throws on a mismatch, and both outcomes carry both hashes, because the
 * caller with a difference in hand still has to say what it means. A missing file and an unfindable
 * block do throw, and they throw as different errors: a hash that differs and a file that is not
 * there are different problems, and merging them teaches people to ignore the check.
 *
 * A listed name may be a `model` or an `enum`, and an enum is not a nicety. The status list a map
 * declares under `valid_statuses`, and the value it declares under `recycled_when`, are values of
 * an enum that lives outside every model block — so a migration renaming one of them leaves every
 * hashed block byte-identical while the run it guards silently counts nothing, or moves a whole
 * sum from one side of the split to the other. Those are the two drifts this check exists for and
 * the two it could not see, so a map that names its status enum among its blocks now gets what it
 * asked for instead of an error.
 */
export async function verify_fingerprint(
  map: DatabaseMap,
  map_path: string,
): Promise<{ ok: boolean; expected: string; actual: string }> {
  const cut = Math.max(map_path.lastIndexOf("/"), map_path.lastIndexOf("\\"));
  const directory = cut === -1 ? "." : map_path.slice(0, cut) || "/";
  const schema_path = map.fingerprint.schema.startsWith("/")
    ? map.fingerprint.schema
    : `${directory}/${map.fingerprint.schema}`;

  const file = Bun.file(schema_path);
  if (!(await file.exists())) {
    throw new MapMissingError(
      schema_path,
      "The map points its fingerprint at this file. A hash cannot be checked against a file that " +
        "is not there, and an unchecked hash is a written date.",
    );
  }

  const lines = (await file.text()).split("\n");
  const blocks: string[] = [];
  for (const block of map.fingerprint.models) {
    // `model` or `enum`: a schema declares the two the same way, and a map lists a name rather
    // than a kind, so the reader does not have to know which it is to hash it.
    const opener = new RegExp(`^\\s*(?:model|enum)\\s+${block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (opener.test(lines[i] as string)) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      throw new MapSectionError(
        block,
        `no model or enum block declaring it in ${schema_path}, though the map's fingerprint lists it`,
      );
    }
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === "}") {
        end = i;
        break;
      }
    }
    if (end === -1) {
      throw new MapSectionError(
        block,
        `its block in ${schema_path} never closes, so there is nothing definite to hash`,
      );
    }
    blocks.push(lines.slice(start, end + 1).join("\n"));
  }

  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(blocks.join("\n"));
  const actual = hasher.digest("hex");
  const expected = map.fingerprint.sha256;
  return { ok: actual === expected.trim().toLowerCase(), expected, actual };
}
