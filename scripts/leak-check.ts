#!/usr/bin/env bun
/**
 * Leak check — refuses to let a private engagement's vocabulary reach this public repository.
 *
 * The dictionary is split by whether a term is generic by nature. `leak-terms.json`, next to this
 * file, holds only category vocabulary that names nobody. Names and measured figures live in an
 * overlay that never lands here, merged at run time through `--terms <path>` or the colon-separated
 * `LEAK_TERMS` variable — a public denylist of private names would publish exactly what it exists
 * to protect, and a public salt on a short name is a dictionary attack rather than protection.
 * Every run prints which dictionaries it loaded and how many terms each supplied, so a run that
 * checked only the generic half cannot be mistaken for a full pass.
 *
 * `leak-allow.json` carries the exemptions, because policy prose and disclosure are
 * indistinguishable to a substring match. Every exemption needs a reason, is counted on every run,
 * and rots loudly under `--audit`.
 *
 * The gate matters most before a publish. A public registry blocks unpublishing after 72 hours and
 * already-resolved versions stay resolvable afterwards, so a leak that ships cannot be taken back
 * the way a git history can be rewritten and force-pushed.
 *
 * The exit code is the verdict: 1 when anything matched or any allowlist entry was rejected,
 * 0 when the run was clean.
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

type TermFile = {
  note: string;
  categories: TermCategory[];
};

type Exemption = {
  path: string;
  term: string;
  why: string;
};

type AllowFile = {
  note: string;
  exemptions: Exemption[];
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
  term: string;
  category: string;
  why: string;
  text: string;
};

type ScanResult = {
  hits: Hit[];
  scanned: number;
  skipped: number;
};

type Dictionary = {
  path: string;
  terms: number;
  categories: number;
  merged: string[];
  duplicates: number;
};

type Options = {
  mode: "tracked" | "staged" | "path" | "self_test" | "audit";
  commits: boolean;
  commit_range: string | null;
  path: string | null;
  terms: string[];
  quiet: boolean;
  help: boolean;
};

/** The generic half of the dictionary. Overlays supply whatever else a project needs banned. */
const BUILT_IN_TERMS = join(import.meta.dir, "leak-terms.json");

const ALLOWLIST_PATH = join(import.meta.dir, "leak-allow.json");

/** A NUL inside this window means the file is not text worth reading line by line. */
const BINARY_SNIFF_BYTES = 8192;

/** Long minified lines would drown the report; the reported position stays exact regardless. */
const MAX_ECHOED_LINE = 200;

const DEFAULT_COMMIT_RANGE = "HEAD~50..HEAD";

const SKIPPED_DIRECTORIES: Record<string, true> = { ".git": true, node_modules: true };

/** `git log --format=%B%n%H` terminates each message with its own SHA on a line of its own. */
const SHA_LINE = /^[0-9a-f]{40}$/;

/** Only the characters that mean something to the regex engine. Escaping more is a syntax error
 *  under the `u` flag, which rejects identity escapes of ordinary characters. */
const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/g;

/**
 * Merges dictionaries in order, later files layering onto earlier ones. Categories with the same
 * name pool their terms; a term already present keeps its first definition, so a project can
 * extend a category without restating it. Both events are recorded rather than absorbed: a merge
 * that reads as a replacement is how a dictionary quietly loses half its vocabulary.
 */
function load_dictionaries(paths: string[]): { categories: TermCategory[]; loaded: Dictionary[] } {
  const categories: TermCategory[] = [];
  const loaded: Dictionary[] = [];
  for (const path of paths) {
    if (!existsSync(path)) {
      throw new Error(`Dictionary not found: ${path}`);
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as TermFile;
    const merged: string[] = [];
    let added = 0;
    let duplicates = 0;
    for (const category of parsed.categories) {
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
    loaded.push({ path, terms: added, categories: parsed.categories.length, merged, duplicates });
  }
  return { categories, loaded };
}

/**
 * One regex per term.
 *
 * `\b` is the wrong tool here: JavaScript defines it over ASCII word characters, so an accented
 * letter counts as a boundary and a term ending in one would match inside a longer word. Explicit
 * lookarounds over `\p{L}` and `\p{N}` behave the same in every alphabet these dictionaries touch.
 *
 * A bounded term also accepts a trailing `s`, because the common plural is formed that way in both
 * languages involved and a plural discloses exactly as much as the singular.
 *
 * Multi-word terms join on any run of spaces, underscores or hyphens, so a phrase is caught in
 * prose, in a slug and in an identifier alike.
 */
function build_matchers(categories: TermCategory[]): Matcher[] {
  const matchers: Matcher[] = [];
  for (const category of categories) {
    for (const entry of category.terms) {
      const body = entry.term
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(REGEX_SYNTAX, "\\$&"))
        .join("[\\s_-]+");
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

function scan_text(source: string, text: string, matchers: Matcher[]): Hit[] {
  const hits: Hit[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    for (const matcher of matchers) {
      for (const match of line.matchAll(matcher.pattern)) {
        hits.push({
          source,
          line: index + 1,
          column: (match.index ?? 0) + 1,
          term: matcher.term,
          category: matcher.category,
          why: matcher.why,
          text: line,
        });
      }
    }
  }
  return hits;
}

/** `skip` holds the dictionaries and the allowlist: those files quote banned terms by design. */
function scan_files(paths: string[], matchers: Matcher[], root: string, skip: Set<string>): ScanResult {
  const hits: Hit[] = [];
  let scanned = 0;
  let skipped = 0;
  for (const path of paths) {
    const absolute = resolve(path);
    if (skip.has(absolute) || absolute.split(sep).includes(".git")) {
      skipped += 1;
      continue;
    }
    // A staged deletion, a stale index entry and a submodule directory all reach this list too.
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      skipped += 1;
      continue;
    }
    const bytes = readFileSync(absolute);
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).indexOf(0) !== -1) {
      skipped += 1;
      continue;
    }
    scanned += 1;
    hits.push(...scan_text(relative(root, absolute) || absolute, bytes.toString("utf8"), matchers));
  }
  return { hits, scanned, skipped };
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

function scan_commits(root: string, requested: string | null, matchers: Matcher[]): { hits: Hit[]; count: number } {
  // A shallow clone or a young repository has fewer commits than the default window asks for, and
  // git fails the whole command rather than clamping, so fall back to the full history.
  const range =
    requested ?? (run_git(["rev-parse", "--verify", "--quiet", "HEAD~50"], root).ok ? DEFAULT_COMMIT_RANGE : null);
  const args = ["log", "--format=%B%n%H"];
  if (range !== null) {
    args.push(range);
  }
  const logged = run_git(args, root);
  if (!logged.ok) {
    throw new Error(`Could not read commit messages${range === null ? "" : ` for ${range}`}.\n${logged.stderr.trim()}`);
  }
  const commits = parse_commit_messages(logged.stdout);
  const hits: Hit[] = [];
  for (const commit of commits) {
    hits.push(...scan_text(`commit ${commit.sha.slice(0, 12)}`, commit.message, matchers));
  }
  return { hits, count: commits.length };
}

/**
 * An entry without a reason is rejected, never honoured: an unexplained suppression is the exact
 * shape a real leak would take, and the run fails so nobody discovers it by reading the file.
 */
function load_allowlist(): { exemptions: Exemption[]; rejected: string[] } {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { exemptions: [], rejected: [] };
  }
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowFile;
  const exemptions: Exemption[] = [];
  const rejected: string[] = [];
  for (const [index, entry] of (parsed.exemptions ?? []).entries()) {
    const path = typeof entry.path === "string" ? entry.path.trim().replace(/^\.\//, "") : "";
    const term = typeof entry.term === "string" ? entry.term.trim() : "";
    const why = typeof entry.why === "string" ? entry.why.trim() : "";
    const label = `entry ${index + 1}${path === "" ? "" : ` (${path}${term === "" ? "" : ` — ${term}`})`}`;
    if (path === "" || term === "") {
      rejected.push(`${label}: \`path\` and \`term\` are both required, so the exemption is not applied.`);
      continue;
    }
    if (why === "") {
      rejected.push(`${label}: \`why\` is missing or empty, so the exemption is not applied.`);
      continue;
    }
    exemptions.push({ path, term, why });
  }
  return { exemptions, rejected };
}

function partition_hits(hits: Hit[], exemptions: Exemption[]): { reported: Hit[]; exempt: Hit[] } {
  const allowed = new Set(exemptions.map((entry) => `${entry.path}\u0000${entry.term.toLowerCase()}`));
  const reported: Hit[] = [];
  const exempt: Hit[] = [];
  for (const hit of hits) {
    if (allowed.has(`${hit.source}\u0000${hit.term.toLowerCase()}`)) {
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
  return `${loaded.length} ${loaded.length === 1 ? "dictionary" : "dictionaries"} (${total} terms)`;
}

/** Printed on every run, quiet included: a narrower dictionary must never look like a full pass. */
function report_dictionaries(loaded: Dictionary[]): void {
  console.log(`Dictionaries: ${describe_dictionaries(loaded)}.`);
  for (const entry of loaded) {
    const terms = `${entry.terms} ${entry.terms === 1 ? "term" : "terms"}`;
    const categories = `${entry.categories} ${entry.categories === 1 ? "category" : "categories"}`;
    console.log(`  ${terms.padStart(9)} in ${categories}  ${shorten(entry.path)}`);
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
  if (loaded.length === 1) {
    console.log("  No overlay loaded (--terms <path>, LEAK_TERMS): only the built-in vocabulary is being checked.");
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
      console.log(`${hit.source}:${hit.line}:${hit.column}: ${hit.term} (${hit.category}) — ${hit.why}`);
      console.log(`    ${text.length > MAX_ECHOED_LINE ? `${text.slice(0, MAX_ECHOED_LINE)}…` : text}`);
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
    console.log(`Allowlist errors: ${rejected.length}.`);
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
      ? `${rejected.length} rejected allowlist ${rejected.length === 1 ? "entry" : "entries"}`
      : `${reported.length} ${reported.length === 1 ? "hit" : "hits"} in ${by_category.size} ` +
        `${by_category.size === 1 ? "category" : "categories"} (${exempt.length} more suppressed)`;
  console.log(
    `FAILED — ${counts} across ${scope}. ${backing} ` +
      "Nothing may be published, committed or pushed until every hit is gone.",
  );
}

/**
 * Reads every exemption aloud and checks it still describes reality. A suppression nobody re-reads
 * is where a real leak eventually hides, so a stale one fails the audit rather than sitting quietly.
 */
function audit_allowlist(root: string, exemptions: Exemption[], rejected: string[], matchers: Matcher[]): number {
  const by_term = new Map(matchers.map((matcher) => [matcher.term.toLowerCase(), matcher]));
  let stale = 0;
  console.log("");
  console.log(`Allowlist: ${exemptions.length} active, ${rejected.length} rejected — ${shorten(ALLOWLIST_PATH)}`);
  console.log("");
  for (const entry of exemptions) {
    const absolute = join(root, entry.path);
    const matcher = by_term.get(entry.term.toLowerCase());
    let status = "ok";
    if (!existsSync(absolute)) {
      status = "STALE — the file no longer exists";
    } else if (matcher === undefined) {
      status = "STALE — no loaded dictionary defines this term";
    } else if (scan_text(entry.path, readFileSync(absolute, "utf8"), [matcher]).length === 0) {
      status = "STALE — the file no longer contains this term";
    }
    if (status !== "ok") {
      stale += 1;
    }
    console.log(`${status === "ok" ? "  ok   " : "  STALE"}  ${entry.path} — ${entry.term}`);
    console.log(`          ${entry.why}`);
    if (status !== "ok") {
      console.log(`          ${status}`);
    }
  }
  for (const failure of rejected) {
    console.log(`  REJECTED  ${failure}`);
  }
  console.log("");
  if (stale === 0 && rejected.length === 0) {
    console.log(`Audit PASSED — every exemption still describes a real, explained occurrence.`);
    return 0;
  }
  console.log(
    `Audit FAILED — ${stale} stale and ${rejected.length} rejected. ` +
      "Delete what no longer applies and give every remaining entry a reason.",
  );
  return 1;
}

/**
 * Proves the checker against fixtures it writes itself, so the result never depends on what the
 * repository happens to contain today. Four claims: a planted term from every loaded category is
 * found, a bounded term buried inside a longer token is not, a run with hits maps to exit code 1,
 * and so does a run whose only problem is a rejected allowlist entry.
 */
function self_test(categories: TermCategory[], matchers: Matcher[]): number {
  const directory = mkdtempSync(join(tmpdir(), "maccing-leak-self-test-"));
  try {
    const planted: string[] = [];
    for (const category of categories) {
      const first = category.terms[0];
      if (first === undefined) {
        continue;
      }
      planted.push(first.term);
      writeFileSync(join(directory, `planted-${category.name}.txt`), `A line that must be caught: ${first.term}\n`);
    }

    // Every bounded term buried inside a longer token. None of these may be reported.
    const buried = categories
      .flatMap((category) => category.terms)
      .filter((entry) => entry.word_boundary && !entry.term.includes(" "))
      .map((entry) => `x${entry.term}x`);
    const control = "boundary-control.txt";
    writeFileSync(join(directory, control), `${buried.join(" ")}\nAn ordinary English line with nothing to hide.\n`);

    const result = scan_files(walk_path(directory), matchers, directory, new Set());
    const found = [...new Set(result.hits.map((hit) => hit.term))].sort();
    const expected = [...new Set(planted)].sort();

    const failures: string[] = [];
    for (const term of expected) {
      if (!found.includes(term)) {
        failures.push(`planted term not found: ${term}`);
      }
    }
    for (const term of found) {
      if (!expected.includes(term)) {
        failures.push(`term reported that was never planted: ${term}`);
      }
    }
    const false_hits = result.hits.filter((hit) => hit.source === control);
    for (const hit of false_hits) {
      failures.push(`boundary control matched at column ${hit.column}: ${hit.term}`);
    }
    if (exit_code_for(result.hits, 0) !== 1) {
      failures.push("a run with planted hits did not map to exit code 1");
    }
    if (exit_code_for([], 1) !== 1) {
      failures.push("a rejected allowlist entry did not map to exit code 1");
    }
    if (exit_code_for([], 0) !== 0) {
      failures.push("a run with no hits and no errors did not map to exit code 0");
    }

    console.log(
      `Self-test: ${expected.length} terms planted across ${categories.length} categories, ${found.length} found, ` +
        `${buried.length} boundary controls, ${false_hits.length} false hits.`,
    );
    if (failures.length > 0) {
      for (const failure of failures) {
        console.log(`  ${failure}`);
      }
      console.log("Self-test FAILED — the checker does not do what it claims.");
      return 1;
    }
    console.log("Self-test PASSED — a planted violation is found in every category and exits 1.");
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
      "",
      "  (no options)          scan every tracked file",
      "  --staged              scan only staged files, for a pre-commit gate",
      "  --path <p>            scan one file or directory instead of the repository",
      "  --commits [<range>]   also scan commit messages (default HEAD~50..HEAD)",
      "  --terms <path>        merge an overlay dictionary; repeatable",
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
    const dictionaries = [BUILT_IN_TERMS, ...options.terms.map((path) => resolve(path))];
    const { categories, loaded } = load_dictionaries(dictionaries);
    const matchers = build_matchers(categories);
    report_dictionaries(loaded);

    if (options.mode === "self_test") {
      return self_test(categories, matchers);
    }

    const { exemptions, rejected } = load_allowlist();

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
      scopes.push(`files under ${options.path}`);
    } else {
      root = repo_root(import.meta.dir);
      files = list_repository_files(root, options.mode === "staged");
      scopes.push(options.mode === "staged" ? "staged files" : "tracked files");
    }

    // The scan skips every loaded dictionary, or the checker would fail on its own vocabulary.
    // An overlay committed into the tree being scanned therefore becomes the one file its own
    // terms can never be found in, which is the exact failure the split dictionary exists to
    // prevent. Refuse the run rather than pass it.
    for (const dictionary of dictionaries) {
      const here = relative(root, dictionary);
      if (dictionary !== BUILT_IN_TERMS && here !== "" && !here.startsWith("..") && !isAbsolute(here)) {
        throw new Error(
          `Overlay dictionary inside the repository being scanned: ${here}\n` +
            "Dictionaries are skipped by the scan, so this one would be invisible to the gate that " +
            "is supposed to keep its contents out. Keep the overlay outside this repository and " +
            "merge it by path with --terms or LEAK_TERMS.",
        );
      }
    }

    const result = scan_files(files, matchers, root, new Set([...dictionaries, ALLOWLIST_PATH]));
    const hits = [...result.hits];
    // Coverage is part of the verdict: a reader must know how much the gate declined to look at.
    const skipped = result.skipped > 0 ? ` (${result.skipped} skipped as binary, absent or self-referential)` : "";
    scopes[0] = `${result.scanned} ${scopes[0]}${skipped}`;

    if (options.commits) {
      const scanned = scan_commits(repo_root(root), options.commit_range, matchers);
      hits.push(...scanned.hits);
      scopes.push(`${scanned.count} commit ${scanned.count === 1 ? "message" : "messages"}`);
    }

    const { reported, exempt } = partition_hits(hits, exemptions);
    report({
      reported,
      exempt,
      exemptions: exemptions.length,
      rejected,
      scope: scopes.join(" and "),
      quiet: options.quiet,
      dictionaries: loaded,
    });
    return exit_code_for(reported, rejected.length);
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    return 2;
  }
}

process.exit(main());
