#!/usr/bin/env bun
/**
 * Leak check — refuses to let a private engagement's vocabulary reach this public repository.
 *
 * The vocabulary is not here. `leak-terms.json`, next to this file, documents the schema and
 * declares nothing: a curated list of one sector's words identifies that sector precisely, so the
 * list is itself the disclosure whether or not a client is ever named. This repository ships the
 * mechanism. Each project keeps its own dictionary outside this tree and merges it at run time
 * with `--terms <path>` or the colon-separated `LEAK_TERMS` variable. An overlay carries its own
 * exemptions too, for the same reason: an exemption has to quote the term it exempts, so a public
 * allowlist would republish a subset of the very vocabulary being withheld.
 *
 * Because the mechanism on its own finds nothing, `--require-overlay` fails a run that merged no
 * overlay. Every hook and every CI step passes it: a gate that passed on an empty dictionary is
 * otherwise indistinguishable from a gate that passed on a clean tree, and only the header says
 * which — while every caller reads the exit code.
 *
 * Dictionaries are scanned like any other file. Only the exact term strings a dictionary declares
 * are suppressed inside it, never the whole file, so a client name typed into a `why` is still
 * found. A deliberate suppression is reported apart from an unreadable file, because a blind spot
 * counted as coverage is worse than no coverage report at all.
 *
 * Matching runs on a normalised copy of each file — percent-escapes decoded, invisible formatting
 * characters dropped, the rest composed to NFC — and a phrase may cross one line break. Every
 * reported position maps back to the bytes as written.
 *
 * The gate matters most before a publish. A public registry blocks unpublishing after 72 hours and
 * already-resolved versions stay resolvable afterwards, so a leak that ships cannot be taken back
 * the way a git history can be rewritten and force-pushed.
 *
 * The exit code is the verdict: 1 when anything matched or any exemption was rejected, 0 when the
 * run was clean, 2 when the run could not be performed as asked.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

type TermEntry = {
  term: string;
  word_boundary: boolean;
  why: string;
};

type TermCategory = {
  name: string;
  why: string;
  terms: TermEntry[];
};

type Exemption = {
  path: string;
  category: string;
  term: string;
  line: number;
  why: string;
  source: string;
};

type TermFile = {
  note: string;
  categories: TermCategory[];
  exemptions?: Array<Partial<Exemption>>;
};

type Matcher = {
  term: string;
  category: string;
  why: string;
  pattern: RegExp;
};

type Hit = {
  source: string;
  line: number;
  column: number;
  span: number;
  term: string;
  category: string;
  why: string;
  text: string;
};

type ScanResult = {
  hits: Hit[];
  scanned: number;
  unreadable: number;
  excluded: number;
  self_quoted: number;
};

type Dictionary = {
  path: string;
  terms: number;
  categories: number;
  merged: string[];
  duplicates: number;
  exemptions: number;
};

type Loaded = {
  categories: TermCategory[];
  exemptions: Exemption[];
  rejected: string[];
  dictionaries: Dictionary[];
  /** Per dictionary file, the term strings it necessarily quotes: its own terms and exemptions. */
  quoted: Map<string, Set<string>>;
};

type Options = {
  mode: "tracked" | "staged" | "path" | "self_test" | "audit";
  commits: boolean;
  commit_range: string | null;
  path: string | null;
  terms: string[];
  require_overlay: boolean;
  quiet: boolean;
  help: boolean;
};

/** Schema documentation and an empty category list. The vocabulary lives in a project's overlay. */
const BUILT_IN_TERMS = join(import.meta.dir, "leak-terms.json");

/** A NUL inside this window means the file is not text worth reading line by line. */
const BINARY_SNIFF_BYTES = 8192;

/** Long minified lines would drown the report; the reported position stays exact regardless. */
const MAX_ECHOED_LINE = 200;

const SKIPPED_DIRECTORIES: Record<string, true> = { ".git": true, node_modules: true };

/** `git log --format=%B%n%H` terminates each message with its own SHA on a line of its own. */
const SHA_LINE = /^[0-9a-f]{40}$/;

/** Only the characters that mean something to the regex engine. Escaping more is a syntax error
 *  under the `u` flag, which rejects identity escapes of ordinary characters. */
const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/g;

/**
 * Characters with no glyph of their own: zero-width spaces and joiners, the word joiner and the
 * invisible operators, the byte-order mark, the soft hyphen, the combining grapheme joiner, the
 * bidirectional marks, embeddings, overrides and isolates, the deprecated format controls and the
 * variation selectors. One of these inside a word hides it from a raw match while a reader sees
 * the word intact, so they are dropped before matching rather than treated as letters.
 */
const INVISIBLE =
  // Matching these marks individually, outside any grapheme they belong to, is the entire point:
  // they are being stripped before comparison, never read as text.
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: stripping the marks is the intent
  /[\u00ad\u034f\u061c\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufe00-\ufe0f\ufeff]/u;

/** A combining mark belongs to the character before it, and NFC has to see them together. */
const COMBINING = /\p{M}/u;

/** The cheap test for whether a file needs the mapped copy at all. Almost none of them do, and a
 *  bare `%` in a percentage is not enough — only an actual escape, an invisible character or a
 *  combining mark can change what a term looks like. */
const NEEDS_NORMALISING =
  // Same reason as INVISIBLE above: this detects the marks that hide a term, so it has to see
  // each one on its own rather than as part of the character it attaches to.
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: detecting the marks is the intent
  /%[0-9a-fA-F]{2}|[\u00ad\u034f\u061c\u180b-\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufe00-\ufe0f\ufeff]|\p{M}/u;

/** Any whitespace except a line break, so the phrase rule can treat a break as its own case. */
const GAP = "(?:[^\\S\\r\\n]|[_-])";

/**
 * What may sit between the words of a multi-word term: spaces, underscores or hyphens, and at
 * most one line break. A phrase typed across a wrap is the same disclosure as a phrase on one
 * line; a phrase separated by a blank line is two unrelated words and must not be reported.
 */
const PHRASE_JOIN = `(?:${GAP}+\\r?\\n?${GAP}*|\\r?\\n${GAP}*)`;

const DECODER = new TextDecoder("utf-8");

/**
 * Invented vocabulary that exists only inside `--self-test`. It names nobody, so the self-test
 * proves the checker with no dictionary present at all, and it covers the shapes that the four
 * closed bypasses need: an accented term, a multi-word phrase, and a whole-word short term.
 */
const SELF_TEST_CATEGORIES: TermCategory[] = [
  {
    name: "self_test_fixture",
    why: "Invented words used only by --self-test, so the checker can be proved without quoting anything real and without any dictionary being present.",
    terms: [
      {
        term: "zarquilon",
        word_boundary: false,
        why: "An invented word with no collisions, matched anywhere, used for the zero-width and percent-encoding fixtures.",
      },
      {
        term: "cr\u00ebnalix",
        word_boundary: false,
        why: "An invented word carrying an accent, used for the decomposed-spelling fixture.",
      },
      {
        term: "vondrel mikashe",
        word_boundary: false,
        why: "An invented two-word phrase, used for the line-break fixture and for the blank-line control.",
      },
      {
        term: "brulq",
        word_boundary: true,
        why: "An invented short word matched as a whole word only, used for the boundary control.",
      },
    ],
  },
];

/**
 * Merges dictionaries in order, later files layering onto earlier ones. Categories with the same
 * name pool their terms; a term already present keeps its first definition, so a project can
 * extend a category without restating it. Both events are recorded rather than absorbed: a merge
 * that reads as a replacement is how a dictionary quietly loses half its vocabulary.
 *
 * Exemptions travel with the dictionary that needs them, because an exemption quotes the term it
 * exempts and a public list of those republishes the vocabulary the split exists to withhold.
 */
function load_dictionaries(paths: string[]): Loaded {
  const categories: TermCategory[] = [];
  const exemptions: Exemption[] = [];
  const rejected: string[] = [];
  const dictionaries: Dictionary[] = [];
  const quoted = new Map<string, Set<string>>();
  for (const path of paths) {
    if (!existsSync(path)) {
      throw new Error(`Dictionary not found: ${path}`);
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as TermFile;
    const quotes = new Set<string>();
    quoted.set(path, quotes);
    const merged: string[] = [];
    let added = 0;
    let duplicates = 0;
    for (const category of parsed.categories ?? []) {
      for (const entry of category.terms) {
        quotes.add(entry.term.toLowerCase());
      }
      const existing = categories.find((candidate) => candidate.name === category.name);
      if (existing === undefined) {
        categories.push({ ...category, terms: [...category.terms] });
        added += category.terms.length;
        continue;
      }
      merged.push(category.name);
      for (const entry of category.terms) {
        if (existing.terms.some((candidate) => candidate.term === entry.term)) {
          duplicates += 1;
          continue;
        }
        existing.terms.push(entry);
        added += 1;
      }
    }
    const parsed_exemptions = read_exemptions(path, parsed.exemptions ?? []);
    for (const entry of parsed_exemptions.exemptions) {
      quotes.add(entry.term.toLowerCase());
    }
    exemptions.push(...parsed_exemptions.exemptions);
    rejected.push(...parsed_exemptions.rejected);
    dictionaries.push({
      path,
      terms: added,
      categories: (parsed.categories ?? []).length,
      merged,
      duplicates,
      exemptions: parsed_exemptions.exemptions.length,
    });
  }
  return { categories, exemptions, rejected, dictionaries, quoted };
}

/**
 * An entry without a reason is rejected, never honoured: an unexplained suppression is the exact
 * shape a real leak would take, and the run fails so nobody discovers it by reading the file.
 *
 * `category` is required as well as `term`, or an exemption written against one category silently
 * absorbs the same spelling under another — including a category its author never saw. `line`
 * records the occurrence the exemption was actually written for, so `--audit` can say when the
 * entry has drifted off it.
 */
function read_exemptions(
  source: string,
  entries: Array<Partial<Exemption>>,
): {
  exemptions: Exemption[];
  rejected: string[];
} {
  const exemptions: Exemption[] = [];
  const rejected: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const path = typeof entry.path === "string" ? entry.path.trim().replace(/^\.\//, "") : "";
    const category = typeof entry.category === "string" ? entry.category.trim() : "";
    const term = typeof entry.term === "string" ? entry.term.trim() : "";
    const why = typeof entry.why === "string" ? entry.why.trim() : "";
    const line = typeof entry.line === "number" && Number.isInteger(entry.line) && entry.line > 0 ? entry.line : 0;
    const named = path === "" ? "" : ` (${path}${term === "" ? "" : ` — ${term}`})`;
    const label = `${shorten(source)} entry ${index + 1}${named}`;
    if (path === "" || term === "" || category === "") {
      rejected.push(`${label}: \`path\`, \`category\` and \`term\` are all required, so the exemption is not applied.`);
      continue;
    }
    if (why === "") {
      rejected.push(`${label}: \`why\` is missing or empty, so the exemption is not applied.`);
      continue;
    }
    if (line === 0) {
      rejected.push(
        `${label}: \`line\` is missing or not a positive integer. An exemption records the occurrence it was ` +
          "written for so --audit can tell when it has drifted; without it the exemption is not applied.",
      );
      continue;
    }
    exemptions.push({ path, category, term, line, why, source });
  }
  return { exemptions, rejected };
}

/**
 * One regex per term.
 *
 * `\b` is the wrong tool here: JavaScript defines it over ASCII word characters, so an accented
 * letter counts as a boundary and a term ending in one would match inside a longer word. Explicit
 * lookarounds over `\p{L}` and `\p{N}` behave the same in every alphabet these dictionaries touch.
 *
 * A bounded term also accepts a trailing `s`, because the common plural is formed that way in the
 * languages these dictionaries reach and a plural discloses exactly as much as the singular.
 */
function build_matchers(categories: TermCategory[]): Matcher[] {
  const matchers: Matcher[] = [];
  for (const category of categories) {
    for (const entry of category.terms) {
      const body = entry.term
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(REGEX_SYNTAX, "\\$&"))
        .join(PHRASE_JOIN);
      const source = entry.word_boundary ? `(?<![\\p{L}\\p{N}_])${body}s?(?![\\p{L}\\p{N}_])` : body;
      matchers.push({
        term: entry.term,
        category: category.name,
        why: entry.why,
        pattern: new RegExp(source, "giu"),
      });
    }
  }
  return matchers;
}

/**
 * A copy of a file's text with every evasion undone, plus a map from each character of the copy
 * back to its index in the text as written, so a reported position still points at the bytes on
 * disk. `origin` is `null` when the copy is the original, which is the overwhelmingly common case
 * and worth not allocating for.
 */
type Normalised = { text: string; origin: number[] | null };

function hex_value(character: string): number {
  const code = character.charCodeAt(0);
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  if (code >= 97 && code <= 102) {
    return code - 87;
  }
  if (code >= 65 && code <= 70) {
    return code - 55;
  }
  return -1;
}

/** Appends one chunk to the copy, mapping every UTF-16 unit of it back to one index in the
 *  original. A decomposed cluster and a decoded escape both produce a different number of
 *  characters than they consumed, and this is where that difference is absorbed. */
function push_chunk(piece: string, where: number, characters: string[], origin: number[]): void {
  characters.push(piece);
  for (let unit = 0; unit < piece.length; unit += 1) {
    origin.push(where);
  }
}

/**
 * A term hidden inside a link as `%7A%61…` reads as the term to anyone who follows the link, so
 * escapes are decoded before matching.
 *
 * Percent-encoding is byte-oriented, so a run of escapes can spell one character. Every escape is
 * three characters wide, so the character a decoded code point came from is its byte offset in the
 * run times three — which is what keeps the reported column pointing at the escape a reader sees.
 */
function decode_percent(text: string): Normalised {
  const characters: string[] = [];
  const origin: number[] = [];
  let index = 0;
  while (index < text.length) {
    const high = text.charAt(index) === "%" ? hex_value(text.charAt(index + 1)) : -1;
    if (high < 0 || hex_value(text.charAt(index + 2)) < 0) {
      push_chunk(text.charAt(index), index, characters, origin);
      index += 1;
      continue;
    }
    const bytes: number[] = [];
    const begin = index;
    for (;;) {
      const lead = text.charAt(index) === "%" ? hex_value(text.charAt(index + 1)) : -1;
      const trail = lead < 0 ? -1 : hex_value(text.charAt(index + 2));
      if (trail < 0) {
        break;
      }
      bytes.push(lead * 16 + trail);
      index += 3;
    }
    let byte = 0;
    for (const character of DECODER.decode(Uint8Array.from(bytes))) {
      const point = character.codePointAt(0) ?? 0;
      push_chunk(character, begin + 3 * byte, characters, origin);
      byte += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    }
  }
  return { text: characters.join(""), origin };
}

/**
 * Drops the invisible formatting characters and composes what is left to NFC, one base character
 * and its marks at a time. Composing per cluster is what keeps the map back to the original
 * honest: every character the cluster produces points at the base character it came from, so a
 * term written decomposed reports the position a reader will actually find.
 */
function compose(input: Normalised): Normalised {
  const source = input.text;
  const characters: string[] = [];
  const origin: number[] = [];
  // A code point outside the basic plane occupies two UTF-16 units, and splitting one in half
  // would corrupt the copy that matching runs against.
  let index = 0;
  while (index < source.length) {
    const width = (source.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
    const head = source.slice(index, index + width);
    if (INVISIBLE.test(head)) {
      index += width;
      continue;
    }
    const start = index;
    let cluster = head;
    index += width;
    while (index < source.length) {
      const next_width = (source.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
      const next = source.slice(index, index + next_width);
      if (INVISIBLE.test(next)) {
        index += next_width;
        continue;
      }
      if (!COMBINING.test(next)) {
        break;
      }
      cluster += next;
      index += next_width;
    }
    const where = input.origin === null ? start : (input.origin[start] ?? start);
    push_chunk(cluster.normalize("NFC"), where, characters, origin);
  }
  return { text: characters.join(""), origin };
}

function normalise(text: string): Normalised {
  if (!NEEDS_NORMALISING.test(text)) {
    return { text, origin: null };
  }
  return compose(decode_percent(text));
}

/** Offsets of every line start in the text as written, for turning a match index into a position. */
function line_starts(text: string): number[] {
  const starts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    starts.push(index + 1);
  }
  return starts;
}

function line_of(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((starts[middle] ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/** A phrase caught across a wrap is echoed as one line with the breaks marked, so the report stays
 *  one finding per line and still shows exactly what was written. */
function echo(text: string, starts: number[], first: number, last: number): string {
  const begin = starts[first] ?? 0;
  const end = last + 1 < starts.length ? (starts[last + 1] ?? text.length) - 1 : text.length;
  const slice = text.slice(begin, end);
  return first === last ? slice : slice.replace(/\r?\n/g, " \u23ce ");
}

/**
 * `quoted` names the terms this particular text must contain — a dictionary's own vocabulary, an
 * exemption's own subject. Those occurrences are counted and suppressed; everything else in the
 * same file is reported like any other file, so a name typed into a `why` is still found.
 */
function scan_text(
  source: string,
  text: string,
  matchers: Matcher[],
  quoted: Set<string> | null,
): { hits: Hit[]; suppressed: number } {
  const { text: haystack, origin } = normalise(text);
  const starts = line_starts(text);
  const hits: Hit[] = [];
  let suppressed = 0;
  for (const matcher of matchers) {
    const muted = quoted?.has(matcher.term.toLowerCase());
    for (const match of haystack.matchAll(matcher.pattern)) {
      if (muted) {
        suppressed += 1;
        continue;
      }
      const found = match.index ?? 0;
      const tail = found + Math.max(match[0].length, 1) - 1;
      const begin = origin === null ? found : (origin[found] ?? found);
      const finish = origin === null ? tail : (origin[tail] ?? begin);
      const first = line_of(starts, begin);
      const last = line_of(starts, finish);
      hits.push({
        source,
        line: first + 1,
        column: begin - (starts[first] ?? 0) + 1,
        span: last - first + 1,
        term: matcher.term,
        category: matcher.category,
        why: matcher.why,
        text: echo(text, starts, first, last),
      });
    }
  }
  return { hits, suppressed };
}

/** `quoted` maps a dictionary's absolute path to the term strings it necessarily quotes. */
function scan_files(paths: string[], matchers: Matcher[], root: string, quoted: Map<string, Set<string>>): ScanResult {
  const hits: Hit[] = [];
  let scanned = 0;
  let unreadable = 0;
  let excluded = 0;
  let self_quoted = 0;
  for (const path of paths) {
    const absolute = resolve(path);
    if (absolute.split(sep).includes(".git")) {
      excluded += 1;
      continue;
    }
    // A staged deletion, a stale index entry and a submodule directory all reach this list too.
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      unreadable += 1;
      continue;
    }
    const bytes = readFileSync(absolute);
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).indexOf(0) !== -1) {
      unreadable += 1;
      continue;
    }
    scanned += 1;
    const found = scan_text(
      relative(root, absolute) || absolute,
      bytes.toString("utf8"),
      matchers,
      quoted.get(absolute) ?? null,
    );
    hits.push(...found.hits);
    self_quoted += found.suppressed;
  }
  return { hits, scanned, unreadable, excluded, self_quoted };
}

function run_git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const run = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { ok: run.exitCode === 0, stdout: run.stdout.toString(), stderr: run.stderr.toString() };
}

function repo_root(cwd: string): string {
  const found = run_git(["rev-parse", "--show-toplevel"], cwd);
  if (!found.ok) {
    throw new Error(`Not inside a git repository: ${cwd}\n${found.stderr.trim()}`);
  }
  return found.stdout.trim();
}

/** Tracked files only, so build output, caches and anything ignored never reach the scanner. */
function list_repository_files(root: string, staged: boolean): string[] {
  const args = staged ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"] : ["ls-files", "-z"];
  const listed = run_git(args, root);
  if (!listed.ok) {
    throw new Error(`Could not list ${staged ? "staged" : "tracked"} files.\n${listed.stderr.trim()}`);
  }
  return listed.stdout
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => join(root, entry));
}

function walk_path(target: string): string[] {
  if (!statSync(target).isDirectory()) {
    return [target];
  }
  const found: string[] = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES[entry.name] === undefined) {
        found.push(...walk_path(join(target, entry.name)));
      }
    } else if (entry.isFile()) {
      found.push(join(target, entry.name));
    }
  }
  return found;
}

/**
 * A message line that is itself forty hex characters would be read as the terminator and split one
 * commit in two. The hits are still reported; only the SHA printed beside them would be wrong.
 */
function parse_commit_messages(log: string): Array<{ sha: string; message: string }> {
  const commits: Array<{ sha: string; message: string }> = [];
  let buffer: string[] = [];
  for (const line of log.split("\n")) {
    if (SHA_LINE.test(line)) {
      while (buffer.length > 0 && buffer[buffer.length - 1] === "") {
        buffer.pop();
      }
      commits.push({ sha: line, message: buffer.join("\n") });
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  return commits;
}

/**
 * The whole history by default. The reason to scan commit messages at all is a post-rewrite
 * clearance, where a pass reads as "the history is clean" — so a window that quietly covers the
 * most recent slice of it is the one default that cannot be right.
 *
 * A shallow clone holds only what was fetched, and an explicit range may not resolve in one. Both
 * still run, and both say so in the scope, because a partial history that prints PASSED is the
 * same failure as a partial dictionary that prints PASSED.
 */
function scan_commits(
  root: string,
  requested: string | null,
  matchers: Matcher[],
): { hits: Hit[]; count: number; note: string } {
  const base = ["log", "--format=%B%n%H"];
  let logged = run_git(requested === null ? base : [...base, requested], root);
  const notes: string[] = [];
  if (!logged.ok && requested !== null) {
    logged = run_git(base, root);
    notes.push(`${requested} does not resolve here, so the whole available history was scanned instead`);
  }
  if (!logged.ok) {
    throw new Error(
      `Could not read commit messages${requested === null ? "" : ` for ${requested}`}.\n${logged.stderr.trim()}`,
    );
  }
  const shallow = run_git(["rev-parse", "--is-shallow-repository"], root);
  if (shallow.ok && shallow.stdout.trim() === "true") {
    notes.push("shallow clone, so only the fetched history was available");
  }
  const commits = parse_commit_messages(logged.stdout);
  const hits: Hit[] = [];
  for (const commit of commits) {
    hits.push(...scan_text(`commit ${commit.sha.slice(0, 12)}`, commit.message, matchers, null).hits);
  }
  return { hits, count: commits.length, note: notes.join("; ") };
}

function exemption_key(path: string, category: string, term: string): string {
  return `${path}\u0000${category}\u0000${term.toLowerCase()}`;
}

function partition_hits(hits: Hit[], exemptions: Exemption[]): { reported: Hit[]; exempt: Hit[] } {
  const allowed = new Set(exemptions.map((entry) => exemption_key(entry.path, entry.category, entry.term)));
  const reported: Hit[] = [];
  const exempt: Hit[] = [];
  for (const hit of hits) {
    if (allowed.has(exemption_key(hit.source, hit.category, hit.term))) {
      exempt.push(hit);
    } else {
      reported.push(hit);
    }
  }
  return { reported, exempt };
}

/** The single definition of the verdict, so the self-test asserts the rule main actually uses. */
function exit_code_for(hits: Hit[], errors: number): number {
  return hits.length > 0 || errors > 0 ? 1 : 0;
}

function shorten(path: string): string {
  const here = relative(process.cwd(), path);
  return here === "" || here.startsWith("..") || isAbsolute(here) ? path : here;
}

/** How many dictionaries backed a run, for the header and again for the verdict line. */
function describe_dictionaries(loaded: Dictionary[]): string {
  const total = loaded.reduce((sum, entry) => sum + entry.terms, 0);
  const count = `${loaded.length} ${loaded.length === 1 ? "dictionary" : "dictionaries"}`;
  return `${count} (${total} ${total === 1 ? "term" : "terms"}${total === 0 ? " — nothing to match" : ""})`;
}

/** Printed on every run, quiet included: a narrower dictionary must never look like a full pass. */
function report_dictionaries(loaded: Dictionary[]): void {
  console.log(`Dictionaries: ${describe_dictionaries(loaded)}.`);
  for (const entry of loaded) {
    const terms = `${entry.terms} ${entry.terms === 1 ? "term" : "terms"}`;
    const categories = `${entry.categories} ${entry.categories === 1 ? "category" : "categories"}`;
    const exemptions = entry.exemptions === 0 ? "" : `, ${entry.exemptions} exemptions`;
    console.log(`  ${terms.padStart(9)} in ${categories}${exemptions}  ${shorten(entry.path)}`);
    if (entry.merged.length > 0) {
      console.log(`    extended rather than replaced: ${entry.merged.join(", ")}`);
    }
    if (entry.duplicates > 0) {
      console.log(
        `    ${entry.duplicates} ${entry.duplicates === 1 ? "term was" : "terms were"} already defined earlier; ` +
          "the first definition stands, so the reason printed on a hit is that one",
      );
    }
  }
  if (!loaded.some((entry) => entry.path !== BUILT_IN_TERMS)) {
    console.log(
      "  No overlay loaded (--terms <path>, LEAK_TERMS). The dictionary shipped here declares no vocabulary of " +
        "its own, so this run can find nothing. Pass --require-overlay wherever this runs as a gate.",
    );
  }
}

type Verdict = {
  reported: Hit[];
  exempt: Hit[];
  exemptions: number;
  rejected: string[];
  scope: string;
  quiet: boolean;
  dictionaries: Dictionary[];
};

/**
 * The header scrolls away on a long run and CI keeps the last line, so the verdict repeats how
 * much vocabulary backed it. A pass earned by half a dictionary has to say so where it is read.
 */
function report({ reported, exempt, exemptions, rejected, scope, quiet, dictionaries }: Verdict): void {
  if (!quiet) {
    const ordered = [...reported].sort(
      (left, right) => left.source.localeCompare(right.source) || left.line - right.line || left.column - right.column,
    );
    for (const hit of ordered) {
      const text = hit.text.trimEnd();
      const spans = hit.span > 1 ? ` [spans ${hit.span} lines]` : "";
      console.log(`${hit.source}:${hit.line}:${hit.column}: ${hit.term} (${hit.category})${spans} — ${hit.why}`);
      console.log(`    ${text.length > MAX_ECHOED_LINE ? `${text.slice(0, MAX_ECHOED_LINE)}\u2026` : text}`);
    }
  }

  const by_category = new Map<string, number>();
  for (const hit of reported) {
    by_category.set(hit.category, (by_category.get(hit.category) ?? 0) + 1);
  }

  if (by_category.size > 0) {
    const width = Math.max(...[...by_category.keys()].map((name) => name.length));
    console.log("");
    console.log("Hits by category:");
    for (const [category, count] of [...by_category].sort((left, right) => right[1] - left[1])) {
      console.log(`  ${category.padEnd(width)}  ${count} ${count === 1 ? "hit" : "hits"}`);
    }
  }

  console.log("");
  console.log(
    `Exemptions: ${exemptions} active, ${exempt.length} ${exempt.length === 1 ? "hit" : "hits"} suppressed. ` +
      "Run --audit to read every reason and catch the stale ones.",
  );
  if (rejected.length > 0) {
    console.log(`Exemption errors: ${rejected.length}.`);
    for (const failure of rejected) {
      console.log(`  ${failure}`);
    }
  }

  console.log("");
  const backing = `Checked with ${describe_dictionaries(dictionaries)} and ${exemptions} active ${exemptions === 1 ? "exemption" : "exemptions"}.`;
  if (reported.length === 0 && rejected.length === 0) {
    console.log(`PASSED — no unexempted term found across ${scope}. ${backing}`);
    return;
  }
  const counts =
    reported.length === 0
      ? `${rejected.length} rejected ${rejected.length === 1 ? "exemption" : "exemptions"}`
      : `${reported.length} ${reported.length === 1 ? "hit" : "hits"} in ${by_category.size} ` +
        `${by_category.size === 1 ? "category" : "categories"} (${exempt.length} more suppressed)`;
  console.log(
    `FAILED — ${counts} across ${scope}. ${backing} ` +
      "Nothing may be published, committed or pushed until every hit is gone.",
  );
}

/**
 * Reads every exemption aloud and checks it still describes reality. A suppression nobody re-reads
 * is where a real leak eventually hides, so a stale one fails the audit rather than sitting
 * quietly. Drift — the term still there, at a different line — is reported with the corrected
 * line but does not fail: an exemption that cries wolf every time a paragraph is added above it
 * is an exemption people learn to stop reading.
 */
function audit_allowlist(root: string, exemptions: Exemption[], rejected: string[], matchers: Matcher[]): number {
  const by_key = new Map(
    matchers.map((matcher) => [`${matcher.category}\u0000${matcher.term.toLowerCase()}`, matcher]),
  );
  let stale = 0;
  let drifted = 0;
  const sources = [...new Set(exemptions.map((entry) => shorten(entry.source)))];
  console.log("");
  console.log(
    `Exemptions: ${exemptions.length} active, ${rejected.length} rejected` +
      `${sources.length === 0 ? "" : ` — from ${sources.join(", ")}`}`,
  );
  console.log("");
  for (const entry of exemptions) {
    const absolute = join(root, entry.path);
    const matcher = by_key.get(`${entry.category}\u0000${entry.term.toLowerCase()}`);
    let status = "ok";
    if (!existsSync(absolute)) {
      status = "STALE — the file no longer exists";
    } else if (matcher === undefined) {
      status = `STALE — no loaded dictionary defines ${entry.term} in category ${entry.category}`;
    } else {
      const lines = scan_text(entry.path, readFileSync(absolute, "utf8"), [matcher], null).hits.map((hit) => hit.line);
      if (lines.length === 0) {
        status = "STALE — the file no longer contains this term";
      } else if (!lines.includes(entry.line)) {
        status = `DRIFTED — written for line ${entry.line}, now found at ${lines.join(", ")}`;
      }
    }
    if (status.startsWith("STALE")) {
      stale += 1;
    } else if (status.startsWith("DRIFTED")) {
      drifted += 1;
    }
    const flag = status === "ok" ? "  ok     " : status.startsWith("STALE") ? "  STALE  " : "  DRIFTED";
    console.log(`${flag}  ${entry.path}:${entry.line} — ${entry.term} (${entry.category})`);
    console.log(`           ${entry.why}`);
    if (status !== "ok") {
      console.log(`           ${status}`);
    }
  }
  for (const failure of rejected) {
    console.log(`  REJECTED  ${failure}`);
  }
  console.log("");
  const drift = drifted === 0 ? "" : ` ${drifted} drifted — still real, at a different line; update the entry.`;
  if (stale === 0 && rejected.length === 0) {
    console.log(`Audit PASSED — every exemption still describes a real, explained occurrence.${drift}`);
    return 0;
  }
  console.log(
    `Audit FAILED — ${stale} stale and ${rejected.length} rejected.${drift} ` +
      "Delete what no longer applies and give every remaining entry a reason.",
  );
  return 1;
}

type Fixture = { file: string; body: string; expect: string[] };

/**
 * Proves the checker against fixtures it writes itself, so the result never depends on what the
 * repository happens to contain today, and works with no dictionary loaded at all: the vocabulary
 * it plants is invented here, names nobody, and would be a disclosure in no repository.
 *
 * Every term of every loaded category is planted, not a sample of one per category, because a
 * pattern that fails to match its own term fails in exactly one term at a time.
 *
 * The four evasions that used to work each get a fixture, and each has a control beside it: the
 * gate must catch the term written to slip past, and must still not fire on the shape it is
 * deliberately not supposed to match.
 */
function self_test(categories: TermCategory[]): number {
  const all = [...SELF_TEST_CATEGORIES, ...categories];
  const matchers = build_matchers(all);
  const directory = mkdtempSync(join(tmpdir(), "maccing-leak-self-test-"));
  try {
    const failures: string[] = [];
    const planted: Fixture[] = [];

    let index = 0;
    for (const category of all) {
      for (const entry of category.terms) {
        index += 1;
        planted.push({
          file: `planted-${index}.txt`,
          body: `A line that must be caught: ${entry.term}\nand an ordinary line below it\n`,
          expect: [entry.term],
        });
      }
    }

    planted.push(
      {
        file: "bypass-decomposed.txt",
        body: "An accent written as base plus combining mark: cre\u0308nalix\n",
        expect: ["cr\u00ebnalix"],
      },
      {
        file: "bypass-line-break.txt",
        body: "A phrase broken over a wrap: vondrel\n  mikashe, still one phrase.\n",
        expect: ["vondrel mikashe"],
      },
      {
        file: "bypass-zero-width.txt",
        body: "A zero-width space inside a word: zar\u200bquilon\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-percent-encoded.txt",
        body: "A term encoded in a link: https://example.invalid/?q=%7A%61%72%71%75%69%6c%6f%6e\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-percent-decomposed.txt",
        body: "An encoded accent, decomposed as well: cre%CC%88nalix\n",
        expect: ["cr\u00ebnalix"],
      },
    );

    // Terms matched as whole words only, buried inside longer tokens. None may be reported.
    const bounded = all
      .flatMap((category) => category.terms)
      .filter((entry) => entry.word_boundary && !entry.term.includes(" "))
      .map((entry) => entry.term);
    const controls: Array<{ file: string; body: string; forbid: string[] }> = [
      {
        file: "control-boundary.txt",
        body: `${bounded.map((term) => `x${term}x`).join(" ")}\nAn ordinary English line with nothing to hide.\n`,
        forbid: bounded,
      },
      {
        file: "control-blank-line.txt",
        body: "vondrel\n\nmikashe\n",
        forbid: ["vondrel mikashe"],
      },
    ];

    for (const fixture of planted) {
      writeFileSync(join(directory, fixture.file), fixture.body);
    }
    for (const fixture of controls) {
      writeFileSync(join(directory, fixture.file), fixture.body);
    }

    const result = scan_files(walk_path(directory), matchers, directory, new Map());
    const found = new Map<string, Set<string>>();
    for (const hit of result.hits) {
      const seen = found.get(hit.source) ?? new Set<string>();
      seen.add(hit.term);
      found.set(hit.source, seen);
    }
    for (const fixture of planted) {
      for (const term of fixture.expect) {
        if (!(found.get(fixture.file)?.has(term) ?? false)) {
          failures.push(`${fixture.file}: planted term not found: ${term}`);
        }
      }
    }
    for (const fixture of controls) {
      for (const term of fixture.forbid) {
        if (found.get(fixture.file)?.has(term) ?? false) {
          failures.push(`${fixture.file}: control matched a term it must not: ${term}`);
        }
      }
    }

    // A dictionary is scanned like any other file: only the terms it necessarily quotes are muted.
    const dictionary = scan_text(
      "fixture-dictionary.json",
      "a declared term zarquilon beside an undeclared one, cr\u00ebnalix, in a reason\n",
      matchers,
      new Set(["zarquilon"]),
    );
    if (dictionary.suppressed === 0) {
      failures.push("a dictionary's own term was not suppressed inside it");
    }
    if (!dictionary.hits.some((hit) => hit.term === "cr\u00ebnalix")) {
      failures.push("a term a dictionary does not declare was not reported inside it");
    }
    if (dictionary.hits.some((hit) => hit.term === "zarquilon")) {
      failures.push("a dictionary's own term was reported inside it");
    }

    // An exemption covers one category, not every category that happens to spell a term the same.
    const shared: Hit = {
      source: "fixture.md",
      line: 1,
      column: 1,
      span: 1,
      term: "brulq",
      category: "self_test_fixture",
      why: "",
      text: "",
    };
    const elsewhere: Hit = { ...shared, category: "self_test_other_category" };
    const split = partition_hits(
      [shared, elsewhere],
      [
        {
          path: "fixture.md",
          category: "self_test_fixture",
          term: "brulq",
          line: 1,
          why: "fixture",
          source: "self-test",
        },
      ],
    );
    if (split.exempt.length !== 1 || split.reported.length !== 1) {
      failures.push("an exemption did not suppress exactly the category it names");
    } else if (split.reported[0]?.category !== "self_test_other_category") {
      failures.push("an exemption suppressed the wrong category");
    }

    if (exit_code_for(result.hits, 0) !== 1) {
      failures.push("a run with planted hits did not map to exit code 1");
    }
    if (exit_code_for([], 1) !== 1) {
      failures.push("a rejected exemption did not map to exit code 1");
    }
    if (exit_code_for([], 0) !== 0) {
      failures.push("a run with no hits and no errors did not map to exit code 0");
    }

    const terms = all.reduce((sum, category) => sum + category.terms.length, 0);
    console.log(
      `Self-test: ${terms} ${terms === 1 ? "term" : "terms"} planted one file each across ${all.length} ` +
        `${all.length === 1 ? "category" : "categories"}, ${planted.length - terms} evasion fixtures, ` +
        `${bounded.length} whole-word ${bounded.length === 1 ? "term" : "terms"} buried in the boundary ` +
        `control, ${result.scanned} files scanned.`,
    );
    if (failures.length > 0) {
      for (const failure of failures) {
        console.log(`  ${failure}`);
      }
      console.log("Self-test FAILED — the checker does not do what it claims.");
      return 1;
    }
    console.log(
      "Self-test PASSED — every term is found where it was planted, a decomposed, wrapped, " +
        "zero-width-broken or percent-encoded spelling is caught, no control fires, and a hit exits 1.",
    );
    return 0;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function print_usage(): void {
  console.log(
    [
      "Usage: bun scripts/leak-check.ts [options]",
      "",
      "Scans this repository for vocabulary that belongs to private work. Exits 1 on any hit.",
      "The vocabulary itself is not in this repository: merge a project's overlay to load one.",
      "",
      "  (no options)          scan every tracked file",
      "  --staged              scan only staged files, for a pre-commit gate",
      "  --path <p>            scan one file or directory instead of the repository",
      "  --commits [<range>]   also scan commit messages (default: the whole history)",
      "  --terms <path>        merge an overlay dictionary; repeatable",
      "  --require-overlay     fail unless an overlay was merged; use it wherever this is a gate",
      "  --audit               list every exemption with its reason and flag the stale ones",
      "  --self-test           prove the checker against planted fixtures and exit",
      "  --quiet               print only the summaries, not each hit",
      "  --help                print this text",
      "",
      "  LEAK_TERMS            colon-separated overlay dictionaries, merged before --terms",
    ].join("\n"),
  );
}

function parse_arguments(argv: string[]): Options {
  const options: Options = {
    mode: "tracked",
    commits: false,
    commit_range: null,
    path: null,
    terms: (process.env.LEAK_TERMS ?? "").split(":").filter((entry) => entry.length > 0),
    require_overlay: false,
    quiet: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--staged") {
      options.mode = "staged";
    } else if (argument === "--self-test") {
      options.mode = "self_test";
    } else if (argument === "--audit") {
      options.mode = "audit";
    } else if (argument === "--require-overlay") {
      options.require_overlay = true;
    } else if (argument === "--quiet") {
      options.quiet = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--path" || argument === "--terms") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${argument} needs a path.`);
      }
      if (argument === "--terms") {
        options.terms.push(value);
      } else {
        options.mode = "path";
        options.path = value;
      }
      index += 1;
    } else if (argument === "--commits") {
      options.commits = true;
      const value = argv[index + 1];
      if (value !== undefined && !value.startsWith("-")) {
        options.commit_range = value;
        index += 1;
      }
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

function main(): number {
  let options: Options;
  try {
    options = parse_arguments(Bun.argv.slice(2));
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    print_usage();
    return 2;
  }

  if (options.help) {
    print_usage();
    return 0;
  }

  try {
    const paths = [BUILT_IN_TERMS, ...options.terms.map((path) => resolve(path))];
    const { categories, exemptions, rejected, dictionaries, quoted } = load_dictionaries(paths);
    const matchers = build_matchers(categories);
    report_dictionaries(dictionaries);

    if (options.require_overlay && !dictionaries.some((entry) => entry.path !== BUILT_IN_TERMS)) {
      throw new Error(
        "--require-overlay was given and no overlay dictionary was merged.\n" +
          "The dictionary shipped here declares no vocabulary, so this run would have checked no name, " +
          "no figure and no domain word, printed PASSED and exited 0 — the same exit code as a complete " +
          "run. Merge the project's overlay with --terms <path> or LEAK_TERMS.",
      );
    }

    if (options.mode === "self_test") {
      return self_test(categories);
    }

    if (options.mode === "audit") {
      return audit_allowlist(repo_root(import.meta.dir), exemptions, rejected, matchers);
    }

    let root: string;
    let files: string[];
    const scopes: string[] = [];

    if (options.path !== null) {
      const target = resolve(options.path);
      const base = statSync(target).isDirectory() ? target : dirname(target);
      // Report paths relative to the repository, not to the scanned subtree, so an exemption
      // written once matches whether the run covered one directory or every tracked file.
      const found = run_git(["rev-parse", "--show-toplevel"], base);
      root = found.ok ? found.stdout.trim() : base;
      files = walk_path(target);
    } else {
      root = repo_root(import.meta.dir);
      files = list_repository_files(root, options.mode === "staged");
    }

    // A dictionary mutes its own terms inside itself, so an overlay committed into the tree being
    // scanned would be the one file its own vocabulary could never be reported in — which is the
    // exact failure the split dictionary exists to prevent. Refuse the run rather than pass it.
    for (const dictionary of paths) {
      const here = relative(root, dictionary);
      if (dictionary !== BUILT_IN_TERMS && here !== "" && !here.startsWith("..") && !isAbsolute(here)) {
        throw new Error(
          `Overlay dictionary inside the repository being scanned: ${here}\n` +
            "A dictionary's own terms are suppressed inside it, so committing this one here would put its " +
            "vocabulary in the single file the gate cannot report it in. Keep the overlay outside this " +
            "repository and merge it by path with --terms or LEAK_TERMS.",
        );
      }
    }

    const result = scan_files(files, matchers, root, quoted);
    const hits = [...result.hits];
    // Coverage is part of the verdict, and a deliberate suppression is not the same fact as a file
    // that could not be read: one is a measured blind spot, the other is a gap nobody chose.
    const coverage =
      `${result.unreadable} unreadable (binary, absent or not a file), ` +
      `${result.excluded} excluded by path, ` +
      `${result.self_quoted} ${result.self_quoted === 1 ? "occurrence" : "occurrences"} suppressed inside the ` +
      "dictionary that declares them";
    const files_noun = result.scanned === 1 ? "file" : "files";
    const where =
      options.path !== null
        ? `${files_noun} under ${options.path}`
        : `${options.mode === "staged" ? "staged" : "tracked"} ${files_noun}`;
    scopes.push(`${result.scanned} ${where} (${coverage})`);

    if (options.commits) {
      const scanned = scan_commits(repo_root(root), options.commit_range, matchers);
      hits.push(...scanned.hits);
      const note = scanned.note === "" ? "" : ` (${scanned.note})`;
      scopes.push(`${scanned.count} commit ${scanned.count === 1 ? "message" : "messages"}${note}`);
    }

    const { reported, exempt } = partition_hits(hits, exemptions);
    report({
      reported,
      exempt,
      exemptions: exemptions.length,
      rejected,
      scope: scopes.join(" and "),
      quiet: options.quiet,
      dictionaries,
    });
    return exit_code_for(reported, rejected.length);
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    return 2;
  }
}

process.exit(main());
