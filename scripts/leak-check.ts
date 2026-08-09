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
 * Because the mechanism on its own finds nothing, `--require-overlay` fails a run that loaded no
 * terms — not merely a run that merged no file, because an overlay of `{}` merges fine and matches
 * exactly as much as no overlay at all. Every hook and every CI step passes it: a gate that passed
 * on an empty dictionary is otherwise indistinguishable from a gate that passed on a clean tree,
 * and only the header says which while every caller reads the exit code.
 *
 * Four scopes, and each one names what it does not cover. `--staged` reads content out of the
 * index, never the working tree, because the commit is made of the index. `--message` runs a
 * commit message through the same matcher. `--history` is the clearance: it walks every blob
 * reachable from every ref, every historical path, every annotated tag's own message, and every
 * commit message. A run without `--history` has not looked at the history at all — which is why it
 * is not the default and why the name says so.
 *
 * The clearance and the tracked scan divide the work between them: the tracked scan reads the
 * working tree, so `--history` skips the blobs it has already read. Read, and proved read — every
 * file the tracked scan opens is hashed the way git hashes it, and only those digests earn a skip.
 * Asking the index instead cleared whatever the index merely listed: a file with an unstaged edit,
 * a path left out of a sparse checkout, a path carrying a `skip-worktree` bit. See `blob_id`.
 *
 * Dictionaries are scanned like any other file. Only the exact term strings a dictionary declares
 * are suppressed inside it, never the whole file, so a client name typed into a `why` is still
 * found. What could not be read — undecodable, absent, or not a file — is named rather than
 * counted, and a clean run over it says `PASSED WITH GAPS` rather than `PASSED`, because a blind
 * spot counted as coverage is worse than no coverage report at all.
 *
 * Matching runs on a normalised copy of each text — percent-escapes decoded, invisible formatting
 * characters dropped, the rest folded to NFKC and a short table of Cyrillic and Greek Latin
 * lookalikes folded to Latin — and a phrase may cross one line break. Paths are matched as well as
 * contents: a filename can be the whole disclosure. Every reported position maps back to the
 * characters as written.
 *
 * The gate matters most before a publish. A public registry blocks unpublishing after 72 hours and
 * already-resolved versions stay resolvable afterwards, so a leak that ships cannot be taken back
 * the way a git history can be rewritten and force-pushed.
 *
 * The exit code is the verdict: 1 when anything matched or any exemption was rejected, 0 when the
 * run was clean, 2 when the run could not be performed as asked.
 */

import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  /** The line the entry was written for; 0 names the path itself rather than any line in it. */
  line: number;
  why: string;
  source: string;
  /**
   * A digest of the sentence this entry was written against, when the author recorded one, and
   * `""` when they did not. It is the only thing an entry may say about the text itself, and the
   * only way anything here can tell a rewritten anchor line from the one somebody read and
   * judged. Declared by hand, checked on every run. See `anchor_digest`.
   */
  anchor: string;
  /**
   * Resolved from the tree at run time, never declared: every sentence this entry covers, for
   * matching a hit in the history, where a line number means nothing. See `covers`.
   */
  contexts: string[];
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
  /**
   * A lowercase ASCII run the pattern cannot match without, or `""` when the term has none long
   * enough to be worth screening on. `String.includes` over a lowercased copy is a native search;
   * the pattern is a forty-way alternation of character classes and lookarounds, and running one
   * of those over every historical blob costs seconds where the screen costs milliseconds.
   */
  literal: string;
};

type Hit = {
  source: string;
  /**
   * The repository path this hit belongs to, when the source label is not itself that path — set
   * on history hits, whose label carries a commit as well. An exemption is keyed on this, never on
   * anything parsed back out of a label, because a path may legally contain the characters a label
   * separates on. Unset wherever the source already is the path.
   */
  path?: string;
  /** 1-based, or 0 when the term is in the path itself rather than in any content. */
  line: number;
  column: number;
  span: number;
  /** Characters matched, in the text as written: what the occurrence covers, not merely where. */
  chars: number;
  term: string;
  category: string;
  why: string;
  text: string;
};

type ScanResult = {
  hits: Hit[];
  scanned: number;
  /** Every distinct path component matched, so the history scan can skip the ones done here. */
  nodes: string[];
  /**
   * Git's own name for the content of every file this scan actually read, so the history scan can
   * skip a blob on the evidence that these exact bytes went through the matcher rather than on the
   * index's word that they should have. Empty unless the caller asked for the digests.
   */
  blobs: Set<string>;
  /** Not text, and holding no run of text either: named in the report, never counted as covered. */
  binary: string[];
  /** Not text, but holding runs that are: those runs were matched and the other bytes were not. */
  salvaged: string[];
  /** Listed, and nothing here could be read: named with the reason, and a gap in the verdict. */
  unreadable: string[];
  excluded: number;
  self_quoted: number;
};

/**
 * What the file scan already looked at, by blob and by path component, so the history scan does
 * not report it a second time under a source no exemption can name. Empty when the file scan
 * covered something narrower than the whole index, because then nothing can be assumed covered.
 *
 * `blobs` is what was *read*, and it is proved rather than assumed: every file the scan opens is
 * hashed the way git hashes it, and the digest of those bytes is what lands here. Nothing derived
 * from the index may go in. The index says what a path *should* hold, and a tracked scan reads the
 * working tree, which disagrees with the index whenever a file carries an unstaged edit, is left
 * out of a sparse checkout, has a `skip-worktree` bit set, or cannot be opened at all. Each of
 * those is a committed blob nothing opened; each was once skipped as covered, and each granted a
 * clearance over bytes no run had looked at. See `blob_id`.
 */
type Covered = { blobs: Set<string>; names: Set<string> };

type HistoryResult = {
  hits: Hit[];
  commits: number;
  objects: number;
  blobs: number;
  current: number;
  /** Annotated tag messages read. A tag is an object of its own, and tags are pushed. */
  tags: number;
  /** Named, never merely counted: what the clearance could not read at all, and why. */
  unread: string[];
  /** Named: what the clearance read only the readable runs of. */
  salvaged: string[];
  names: number;
  /** Ref names read: branches, tags, remote-tracking names. Published, and outside every object. */
  refs: number;
  note: string;
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
  mode: "tracked" | "staged" | "path" | "self_test" | "audit" | "message";
  history: boolean;
  history_range: string | null;
  path: string | null;
  message: string | null;
  terms: string[];
  require_overlay: boolean;
  quiet: boolean;
  help: boolean;
};

/** Schema documentation and an empty category list. The vocabulary lives in a project's overlay. */
const BUILT_IN_TERMS = join(import.meta.dir, "leak-terms.json");

/** A NUL inside this window sends the bytes to the encoding sniffer rather than straight to UTF-8. */
const BINARY_SNIFF_BYTES = 8192;

/** Long minified lines would drown the report; the reported position stays exact regardless. */
const MAX_ECHOED_LINE = 200;

/** One historical blob larger than this is reported as skipped rather than read into memory. */
const MAX_BLOB_BYTES = 8 * 1024 * 1024;

/** How many blobs `git cat-file --batch` is asked for at once, to bound peak memory. */
const BLOB_BATCH = 256;

/**
 * How much text either side of an occurrence identifies it.
 *
 * This is the whole key an exemption is matched on. An entry names a line; the sentence at that
 * line is read out of the tree once, and from then on the entry covers that sentence — wherever it
 * has moved to in the file, and in every version of the file the history still holds. Forty-eight
 * characters is a clause either side: enough to tell two sentences apart, short enough to survive
 * an edit elsewhere on the same line.
 */
const EXEMPTION_CONTEXT_RADIUS = 48;

/**
 * How much of the digest an entry records for its own sentence.
 *
 * Twelve hexadecimal characters is what a short object id uses, and what this has to survive is a
 * line being reworded by hand rather than a search for a collision. An author who wants an entry
 * to keep covering a rewritten sentence can paste the new digest in, which is the point: it is a
 * prompt to re-read, not a lock.
 */
const ANCHOR_LENGTH = 12;

/** What a recorded `anchor` must look like, so a typo is refused rather than silently unmatched. */
const ANCHOR_SHAPE = new RegExp(`^[0-9a-f]{${ANCHOR_LENGTH}}$`);

/**
 * How long a run of decodable characters has to be before it is read out of a file that is not text.
 *
 * The length is the only defence against matching entropy, and the number below is empirical: it
 * was measured here, against the files this repository happened to hold on the day it was
 * measured, and it generalises to nothing else. The twelve historical PNG blobs in this
 * repository — 34.9 MB of compressed image — were salvaged at every threshold and matched with a
 * real forty-two-term dictionary, several of whose terms are three and four characters long and
 * word-bounded:
 *
 *     threshold      4     5     6     7     8    16    24    64
 *     false hits    10     4     4     2     0     0     0     0
 *     characters  3.6M  2.0M  1.1M  600k  361k  108k   96k   56k
 *
 * Read that row as a knife edge and not as a floor with room beneath it. Zero begins at eight and
 * two false hits stand at seven, so the whole margin is one character wide, measured over twelve
 * files: one more image, one more short word-bounded term, or a few more megabytes of pixels can
 * put a nine-character fragment of noise in front of the matcher, and nothing in the table above
 * says otherwise. Sixteen is twice the observed edge for exactly that reason. The distance is the
 * safety here; there is no proof that a sixteen-character run cannot be noise.
 *
 * Sixteen also costs almost nothing: above about that length what survives is no longer the sea of
 * accidental fragments but the genuine ASCII inside a PNG — its chunk names, its embedded colour
 * profile — so sixty-four down to sixteen not quite doubles the salvaged surface where four would
 * have multiplied it by sixty-five. What it buys is a disclosure of sixteen characters, where
 * before it took sixty-four to be found.
 *
 * So the number belongs to this repository's current contents rather than to the technique. Once
 * the image set changes — anything added, replaced or removed — the measurement above is a
 * measurement of files that are no longer here: re-run the sweep over the new blobs with the
 * dictionary actually in use, read the false-hit row again, and do not lower this on the strength
 * of the table above.
 */
const SALVAGE_RUN_CHARACTERS = 16;

/**
 * How much unreadable material a phrase may be matched across, in characters.
 *
 * Runs of readable text are joined by a blank line, which no phrase crosses, because two runs
 * either side of a megabyte of entropy were never one sentence and matching across them invents a
 * phrase nobody wrote. But the case this salvage exists for is a mostly-text file with a damaged
 * byte, and that byte can land between the words of a term rather than politely outside it. A gap
 * this short is joined by a single line break instead — the same gap a wrapped phrase already
 * crosses — and it is as wide as one damaged character gets: a truncated UTF-8 sequence decodes to
 * at most three replacement characters, and a stray CRLF is two.
 */
const SALVAGE_BRIDGE_CHARACTERS = 3;

/** What separates one run of readable text from the next inside a file that is not text: NUL, the
 *  other C0 controls, DEL, and the replacement character an undecodable byte becomes. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: finding control characters is the job
const NOT_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]+/u;

/** The `tag <name>` header of an annotated tag object, which is also the name that gets pushed. */
const TAG_NAME = /^tag (.+)$/m;

const SKIPPED_DIRECTORIES: Record<string, true> = { ".git": true, node_modules: true };

/** `git log --format=%B%n%H` terminates each message with its own SHA on a line of its own. */
const SHA_LINE = /^[0-9a-f]{40}$/;

/** Everything from git's scissors line down is stripped from the message before it is recorded. */
const SCISSORS = /^.\s*-{2,}\s*>8\s*-{2,}/;

/** Only the characters that mean something to the regex engine. Escaping more is a syntax error
 *  under the `u` flag, which rejects identity escapes of ordinary characters. */
const REGEX_SYNTAX = /[.*+?^${}()|[\]\\]/g;

/** Inside a character class the syntax is different and much shorter. */
const CLASS_SYNTAX = /[\\\]^-]/g;

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

/** A combining mark belongs to the character before it, and composition has to see them together. */
const COMBINING = /\p{M}/u;

/**
 * Letters from another script drawn to look like Latin ones. A full Unicode confusables table is
 * thousands of entries and most of them are unreachable in a repository of English and Portuguese
 * prose; the Cyrillic and Greek letters below are the ones an evasion would actually reach for,
 * and folding them costs one lookup per character.
 *
 * The fold is one-way and deliberately lossy: genuine Cyrillic or Greek text is folded too, so a
 * repository written in either would see false positives. That trade is documented in
 * `scripts/README.md` rather than hidden, and it is the right way round for a gate.
 */
const CONFUSABLE: Record<string, string> = {
  // Cyrillic, uppercase
  "\u0410": "A", // А
  "\u0412": "B", // В
  "\u0415": "E", // Е
  "\u041a": "K", // К
  "\u041c": "M", // М
  "\u041d": "H", // Н
  "\u041e": "O", // О
  "\u0420": "P", // Р
  "\u0421": "C", // С
  "\u0422": "T", // Т
  "\u0423": "Y", // У
  "\u0425": "X", // Х
  "\u0405": "S", // Ѕ
  "\u0406": "I", // І
  "\u0408": "J", // Ј
  "\u04c0": "I", // Ӏ
  "\u0501": "D", // ԁ's capital pair
  "\u051a": "Q", // Ԛ
  "\u051c": "W", // Ԝ
  "\u0474": "V", // Ѵ
  // Cyrillic, lowercase
  "\u0430": "a", // а
  "\u0432": "b", // в
  "\u0435": "e", // е
  "\u043a": "k", // к
  "\u043c": "m", // м
  "\u043d": "h", // н
  "\u043e": "o", // о
  "\u0440": "p", // р
  "\u0441": "c", // с
  "\u0442": "t", // т
  "\u0443": "y", // у
  "\u0445": "x", // х
  "\u0455": "s", // ѕ
  "\u0456": "i", // і
  "\u0458": "j", // ј
  "\u04cf": "l", // ӏ
  "\u0500": "d", // Ԁ's small pair
  "\u051b": "q", // ԛ
  "\u051d": "w", // ԝ
  "\u0475": "v", // ѵ
  "\u04bb": "h", // һ
  "\u0261": "g", // ɡ, Latin script but drawn as the single-storey g
  // Greek, uppercase
  "\u0391": "A", // Α
  "\u0392": "B", // Β
  "\u0395": "E", // Ε
  "\u0396": "Z", // Ζ
  "\u0397": "H", // Η
  "\u0399": "I", // Ι
  "\u039a": "K", // Κ
  "\u039c": "M", // Μ
  "\u039d": "N", // Ν
  "\u039f": "O", // Ο
  "\u03a1": "P", // Ρ
  "\u03a4": "T", // Τ
  "\u03a5": "Y", // Υ
  "\u03a7": "X", // Χ
  "\u03f9": "C", // Ϲ
  "\u037f": "J", // Ϳ
  // Greek, lowercase
  "\u03b1": "a", // α
  "\u03b2": "b", // β
  "\u03b5": "e", // ε
  "\u03b9": "i", // ι
  "\u03ba": "k", // κ
  "\u03bd": "v", // ν
  "\u03bf": "o", // ο
  "\u03c1": "p", // ρ
  "\u03c4": "t", // τ
  "\u03c5": "u", // υ
  "\u03c7": "x", // χ
  "\u03f2": "c", // ϲ
};

/** The blocks the table above draws from, so a text with none of them skips the lookup entirely. */
const CONFUSABLE_BLOCKS = /[\u0261\u037f-\u03ff\u0400-\u052f]/u;

/**
 * The blocks whose characters NFKC rewrites into Latin letters: fullwidth and halfwidth forms,
 * mathematical alphanumerics, the `ﬁ`-style ligatures, letterlike symbols, enclosed and
 * parenthesised alphanumerics, superscripts and subscripts, and the squared Latin abbreviations.
 * This is the cheap first test; the whole-text comparison below it is the one that cannot be
 * fooled, and both run because a missed block here would be a silent hole.
 */
const COMPATIBILITY_BLOCKS =
  /[\u00a0\u02b0-\u02ff\u2070-\u209f\u2100-\u214f\u2150-\u218f\u2460-\u24ff\u3200-\u33ff\ufb00-\ufb4f\ufe30-\ufe6f\uff00-\uffef]|[\u{1d400}-\u{1d7ff}]|[\u{1f100}-\u{1f1ff}]/u;

/** The cheap test for whether a text needs the mapped copy at all. Almost none of them do. */
const NEEDS_MAPPING = new RegExp(
  // Same reason as INVISIBLE above: this detects the marks that hide a term, so it has to see each
  // one on its own rather than as part of the character it attaches to. Built from a string rather
  // than a literal, so the misleading-character-class rule does not apply and needs no suppression.
  "%[0-9a-fA-F]{2}|[\\u00ad\\u034f\\u061c\\u180b-\\u180e\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064" +
    `\\u206a-\\u206f\\ufe00-\\ufe0f\\ufeff]|\\p{M}|${CONFUSABLE_BLOCKS.source}|${COMPATIBILITY_BLOCKS.source}`,
  "u",
);

/** Any whitespace except a line break, so the phrase rule can treat a break as its own case. */
const GAP = "(?:[^\\S\\r\\n]|[_-])";

/**
 * What may sit between the words of a multi-word term: spaces, underscores or hyphens, and at
 * most one line break. A phrase typed across a wrap is the same disclosure as a phrase on one
 * line; a phrase separated by a blank line is two unrelated words and must not be reported.
 *
 * Every quantifier here is unambiguous with the one beside it — a gap character is never `\r` or
 * `\n`, and the trailing `GAP*` sits behind a mandatory line break — so a long run of spaces,
 * underscores, hyphens or tabs that leads nowhere costs one pass, not one pass per split of the
 * run. The earlier `GAP+\r?\n?GAP*` had two quantifiers over the same class in sequence and took
 * quadratic time to fail; `--self-test` now plants the input that used to hang.
 */
const PHRASE_JOIN = `(?:${GAP}+(?:\\r?\\n${GAP}*)?|\\r?\\n${GAP}*)`;

/**
 * A bounded term also accepts a plural or a possessive. `s` and `es` cover the regular plural in
 * the languages these dictionaries reach, and a plural discloses exactly as much as its singular.
 * A plural that rewrites the stem — `-y` to `-ies`, an irregular — is not reachable from a suffix
 * and is documented as residue rather than half-handled.
 */
const PLURAL = "(?:[eE]?[sS]|['\u2019][sS])?";

const UTF8 = new TextDecoder("utf-8");
/** `utf-16` is the encoding standard's own label for the little-endian form; big-endian bytes are
 *  swapped into it rather than decoded by a second, less portable label. */
const UTF16 = new TextDecoder("utf-16");
/** Only ever asked to read a `git cat-file` header, which is ASCII; the label is the one that maps
 *  every byte to a character without failing. */
const ASCII = new TextDecoder("windows-1252");

/**
 * Invented vocabulary that exists only inside `--self-test`. It names nobody, so the self-test
 * proves the checker with no dictionary present at all, and it covers the shapes the closed
 * bypasses need: an accented term, a term carrying an `fi` for the ligature fixture, a multi-word
 * phrase, and a whole-word short term.
 */
const SELF_TEST_CATEGORIES: TermCategory[] = [
  {
    name: "self_test_fixture",
    why: "Invented words used only by --self-test, so the checker can be proved without quoting anything real and without any dictionary being present.",
    terms: [
      {
        term: "zarquilon",
        word_boundary: false,
        why: "An invented word with no collisions, matched anywhere, used for the zero-width, percent-encoding, compatibility-form, confusable, filename and encoding fixtures.",
      },
      {
        term: "cr\u00ebnalix",
        word_boundary: false,
        why: "An invented word carrying an accent, used for the decomposed-spelling fixture.",
      },
      {
        term: "nuvfilax",
        word_boundary: false,
        why: "An invented word carrying an `fi`, used for the ligature fixture that NFC alone walks past.",
      },
      {
        term: "vondrel mikashe",
        word_boundary: false,
        why: "An invented two-word phrase, used for the line-break fixture, the blank-line control, the directory-name fixture and the backtracking fixture.",
      },
      {
        term: "brulq",
        word_boundary: true,
        why: "An invented short word matched as a whole word only, used for the boundary control and the CamelCase, snake_case and plural fixtures.",
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
 *
 * A file that does not parse, or that parses into something that is not a dictionary, fails the
 * run. Treating either as an absent overlay is how a rotated secret containing `{}` passes a gate
 * that was asked to require one.
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
    const parsed = parse_dictionary(path);
    const quotes = new Set<string>();
    quoted.set(path, quotes);
    const merged: string[] = [];
    let added = 0;
    let duplicates = 0;
    for (const category of parsed.categories) {
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
      categories: parsed.categories.length,
      merged,
      duplicates,
      exemptions: parsed_exemptions.exemptions.length,
    });
  }
  return { categories, exemptions, rejected, dictionaries, quoted };
}

/**
 * A dictionary that does not parse is louder than a dictionary that is missing, because a caller
 * who passed `--terms` believes a dictionary was loaded. Every shape check below names the file
 * and what was expected, so a malformed overlay is a two-second fix rather than a hunt.
 */
function parse_dictionary(path: string): TermFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (failure) {
    throw new Error(
      `Dictionary is not valid JSON: ${shorten(path)}\n${failure instanceof Error ? failure.message : String(failure)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `Dictionary is not a JSON object: ${shorten(path)}\n` +
        "A dictionary is an object with a `categories` array. Anything else would load as an empty " +
        "dictionary and pass a gate that checked nothing.",
    );
  }
  const file = parsed as { categories?: unknown; exemptions?: unknown };
  if (file.categories !== undefined && !Array.isArray(file.categories)) {
    throw new Error(`Dictionary \`categories\` is not an array: ${shorten(path)}`);
  }
  if (file.exemptions !== undefined && !Array.isArray(file.exemptions)) {
    throw new Error(`Dictionary \`exemptions\` is not an array: ${shorten(path)}`);
  }
  const categories: TermCategory[] = [];
  for (const [index, raw] of ((file.categories ?? []) as unknown[]).entries()) {
    const candidate = raw as Partial<TermCategory>;
    if (typeof candidate?.name !== "string" || candidate.name.trim() === "") {
      throw new Error(`Dictionary category ${index + 1} has no \`name\`: ${shorten(path)}`);
    }
    if (!Array.isArray(candidate.terms)) {
      throw new Error(`Dictionary category \`${candidate.name}\` has no \`terms\` array: ${shorten(path)}`);
    }
    const terms: TermEntry[] = [];
    for (const [position, entry] of candidate.terms.entries()) {
      const term = typeof entry?.term === "string" ? entry.term.trim() : "";
      if (term === "") {
        throw new Error(
          `Dictionary category \`${candidate.name}\` term ${position + 1} has no \`term\`: ${shorten(path)}`,
        );
      }
      terms.push({
        term,
        word_boundary: entry.word_boundary === true,
        why: typeof entry.why === "string" ? entry.why : "no reason recorded",
      });
    }
    categories.push({ name: candidate.name, why: typeof candidate.why === "string" ? candidate.why : "", terms });
  }
  return {
    note: "",
    categories,
    exemptions: (file.exemptions ?? []) as Array<Partial<Exemption>>,
  };
}

/**
 * An entry without a reason is rejected, never honoured: an unexplained suppression is the exact
 * shape a real leak would take, and the run fails so nobody discovers it by reading the file.
 *
 * `category` is required as well as `term`, or an exemption written against one category silently
 * absorbs the same spelling under another — including a category its author never saw. `line`
 * names the occurrence the exemption covers, and is what keeps it from covering every other
 * occurrence of the same term in the same file forever. A `line` of 0 names the path itself,
 * which is the only occurrence a filename hit can have.
 *
 * No entry declares the sentence it covers. That is read out of the tree at the line the entry
 * names, so an entry stays a note about a line and never becomes a second, hand-written copy of
 * the file it points at. One consequence is worth knowing before writing one: two occurrences of
 * a term in a file, in two different sentences, need two entries. An entry cannot ride on its
 * neighbour's judgement, because it was never asked to make that judgement. See `covers`.
 *
 * `anchor` is the one optional field, and the only thing an entry may say about the sentence
 * itself: the twelve-character digest `--audit` prints for the sentence at `line`. Record it and a
 * rewrite of that line stops the entry dead — it covers nothing, and the run says why — instead of
 * quietly re-pointing the same judgement at whatever the line says now. Leave it out and the entry
 * behaves as it always has, with that one drift unchecked and named as unchecked by `--audit`.
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
    const line = typeof entry.line === "number" && Number.isInteger(entry.line) && entry.line >= 0 ? entry.line : -1;
    const anchor = typeof entry.anchor === "string" ? entry.anchor.trim().toLowerCase() : "";
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
    if (line < 0) {
      rejected.push(
        `${label}: \`line\` is missing or not a whole number that is zero or more. An exemption covers the ` +
          "occurrence it names — the sentence found at that line — and 0 names the path itself; " +
          "without it the exemption is not applied.",
      );
      continue;
    }
    if (anchor !== "" && !ANCHOR_SHAPE.test(anchor)) {
      rejected.push(
        `${label}: \`anchor\` is not ${ANCHOR_LENGTH} hexadecimal characters. It is the digest --audit prints ` +
          "beside the sentence at `line`; copy that value or leave the field out, but do not invent one. The " +
          "exemption is not applied.",
      );
      continue;
    }
    if (anchor !== "" && line === 0) {
      rejected.push(
        `${label}: \`line\` is 0, which names the path itself, and a path has no sentence to anchor — the text ` +
          "this entry covers is already written out in its `path`. Drop `anchor`; the exemption is not applied.",
      );
      continue;
    }
    exemptions.push({ path, category, term, line, why, source, anchor, contexts: [] });
  }
  return { exemptions, rejected };
}

/**
 * A case-insensitive literal built out of character classes rather than the `i` flag.
 *
 * The flag would be shorter, but it applies to the whole pattern, lookarounds included, and the
 * CamelCase boundary below has to be able to say "an uppercase letter here, a lowercase one
 * there". Building the case-insensitivity into the body is what buys that.
 *
 * A letter whose other case is more than one code point — `ß` against `SS` — keeps its own
 * spelling. That residue is documented rather than approximated.
 */
function literal_characters(word: string): string[] {
  const parts: string[] = [];
  for (const character of word) {
    const lower = character.toLowerCase();
    const upper = character.toUpperCase();
    if (lower !== upper && [...lower].length === 1 && [...upper].length === 1) {
      parts.push(`[${lower.replace(CLASS_SYNTAX, "\\$&")}${upper.replace(CLASS_SYNTAX, "\\$&")}]`);
      continue;
    }
    parts.push(character.replace(REGEX_SYNTAX, "\\$&"));
  }
  return parts;
}

/** The pattern body for a term: each word case-insensitive, the words joined by the phrase rule. */
function term_body(term: string, capitalised: boolean): string | null {
  const words = term
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => literal_characters(fold(word)));
  if (words.length === 0) {
    return null;
  }
  if (capitalised) {
    const first = words[0] as string[];
    const head = [...fold(term.trim())][0] ?? "";
    const upper = head.toUpperCase();
    if (upper === head.toLowerCase() || [...upper].length !== 1) {
      return null;
    }
    first[0] = upper.replace(REGEX_SYNTAX, "\\$&");
  }
  return words.map((word) => word.join("")).join(PHRASE_JOIN);
}

/**
 * One regex per term.
 *
 * `\b` is the wrong tool for the bounded rule: JavaScript defines it over ASCII word characters,
 * so an accented letter counts as a boundary and a term ending in one would match inside a longer
 * word. Explicit lookarounds over `\p{L}` and `\p{N}` behave the same in every alphabet these
 * dictionaries touch.
 *
 * A bounded term is caught in three places a plain boundary misses: `foo_brulq_bar`, because an
 * underscore separates tokens rather than joining them; `getBrulqValue`, because a lowercase
 * letter followed by an uppercase one is a word boundary in every identifier convention that
 * exists; and `brulqes`, because the regular plural discloses what the singular does. The
 * CamelCase junction is deliberately narrow — it needs a real lowercase-to-uppercase transition on
 * both sides, so `XBRULQX` still does not match.
 */
function build_matchers(categories: TermCategory[]): Matcher[] {
  const matchers: Matcher[] = [];
  for (const category of categories) {
    for (const entry of category.terms) {
      const plain = term_body(entry.term, false);
      if (plain === null) {
        continue;
      }
      let source = plain;
      if (entry.word_boundary) {
        const camel = term_body(entry.term, true);
        const head =
          camel === null
            ? `(?<![\\p{L}\\p{N}])${plain}`
            : `(?:(?<![\\p{L}\\p{N}])${plain}|(?<=[\\p{Ll}\\p{N}])${camel})`;
        source = `${head}${PLURAL}(?:(?![\\p{L}\\p{N}])|(?<=[\\p{Ll}\\p{N}])(?=\\p{Lu}))`;
      }
      matchers.push({
        term: entry.term,
        category: category.name,
        why: entry.why,
        pattern: new RegExp(source, "gu"),
        literal: screening_literal(entry.term),
      });
    }
  }
  return matchers;
}

/**
 * The longest run of ASCII letters and digits inside one word of the term, lowercased.
 *
 * It has to be something the pattern cannot match without. A run inside a word is contiguous in
 * every match, because only the gaps *between* words are variable. It has to be ASCII, because
 * `toLowerCase` on the haystack applies Unicode's contextual rules — a final `Σ` lowercases to
 * `ς`, not `σ` — and ASCII has no such rule, so lowercasing can never move a match out of reach.
 * Below three characters the screen stops narrowing anything and the term simply goes unscreened.
 */
function screening_literal(term: string): string {
  let best = "";
  for (const run of fold(term).match(/[A-Za-z0-9]+/g) ?? []) {
    if (run.length > best.length) {
      best = run;
    }
  }
  return best.length >= 3 ? best.toLowerCase() : "";
}

/**
 * A copy of a text with every evasion undone, plus a map from each character of the copy back to
 * its index in the text as written, so a reported position still points at the characters on
 * disk. `origin` is `null` when the copy is the original, which is the common case and worth not
 * allocating for.
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
 *  original. A decomposed cluster, a decoded escape and a compatibility form all produce a
 *  different number of characters than they consumed, and this is where that difference is
 *  absorbed. */
function push_chunk(piece: string, where: number, characters: string[], origin: number[]): void {
  characters.push(piece);
  for (let unit = 0; unit < piece.length; unit += 1) {
    origin.push(where);
  }
}

/** Appends a run of characters that map one to one, each unit back to its own index. */
function push_run(
  source: string,
  from: number,
  to: number,
  input: number[] | null,
  characters: string[],
  origin: number[],
): void {
  characters.push(source.slice(from, to));
  for (let unit = from; unit < to; unit += 1) {
    origin.push(input === null ? unit : (input[unit] ?? unit));
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
  if (!text.includes("%")) {
    return { text, origin: null };
  }
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
    for (const character of UTF8.decode(Uint8Array.from(bytes))) {
      const point = character.codePointAt(0) ?? 0;
      push_chunk(character, begin + 3 * byte, characters, origin);
      byte += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    }
  }
  return { text: characters.join(""), origin };
}

/**
 * The one place a string is turned into what matching compares.
 *
 * NFKC rather than NFC, because NFC leaves every compatibility form alone: a fullwidth `ａ`, a
 * mathematical `𝖺` and the `ﬁ` ligature all read as ordinary letters and all walk past an NFC
 * match, including one fullwidth letter dropped into an otherwise plain word. Then the confusable
 * table above folds the Cyrillic and Greek Latin-lookalikes, which no normalisation form touches
 * because they are genuinely different letters.
 */
function fold(text: string): string {
  const composed = text.normalize("NFKC");
  if (!CONFUSABLE_BLOCKS.test(composed)) {
    return composed;
  }
  let folded = "";
  for (const character of composed) {
    folded += CONFUSABLE[character] ?? character;
  }
  return folded;
}

/**
 * Drops the invisible formatting characters and folds what is left, one base character and its
 * marks at a time. Folding per cluster is what keeps the map back to the original honest: every
 * character the cluster produces points at the base character it came from, so a term written
 * decomposed, fullwidth or in Cyrillic reports the position a reader will actually find.
 */
function compose(input: Normalised): Normalised {
  const source = input.text;
  const characters: string[] = [];
  const origin: number[] = [];
  // A code point outside the basic plane occupies two UTF-16 units, and splitting one in half
  // would corrupt the copy that matching runs against.
  let index = 0;
  while (index < source.length) {
    // ASCII is nearly all of every text here, and no ASCII character is invisible, is a combining
    // mark, or is rewritten by NFKC or the confusable table — so a run of it is copied whole
    // rather than sliced, tested and folded one character at a time. The run stops one character
    // short of anything non-ASCII, because that character may be a mark belonging to the last one.
    if (source.charCodeAt(index) < 0x80) {
      let run = index + 1;
      while (run < source.length && source.charCodeAt(run) < 0x80) {
        run += 1;
      }
      if (run < source.length) {
        run -= 1;
      }
      if (run > index) {
        push_run(source, index, run, input.origin, characters, origin);
        index = run;
        continue;
      }
    }
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
    // A single ASCII character only reaches here when a mark follows it, and the cluster then
    // needs the full fold like any other.
    const plain = cluster.length === 1 && cluster.charCodeAt(0) < 0x80;
    push_chunk(plain ? cluster : fold(cluster), where, characters, origin);
  }
  return { text: characters.join(""), origin };
}

/**
 * The block test catches the compatibility forms cheaply; the whole-text comparison catches
 * anything the block list does not know about. Both run, because a block missing from the list
 * above would otherwise be a silent hole rather than a slow path.
 */
function needs_mapping(text: string): boolean {
  return NEEDS_MAPPING.test(text) || text.normalize("NFKC") !== text;
}

function normalise(text: string): Normalised {
  if (!needs_mapping(text)) {
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
  if (matchers.length === 0) {
    return { hits: [], suppressed: 0 };
  }
  const { text: haystack, origin } = normalise(text);
  // Built once and only when a matcher asks for it, because most runs load at least one term with
  // no ASCII run long enough to screen on and every run pays for the copy exactly once.
  let lowered: string | null = null;
  const starts = line_starts(text);
  const hits: Hit[] = [];
  let suppressed = 0;
  for (const matcher of matchers) {
    if (matcher.literal !== "") {
      lowered ??= haystack.toLowerCase();
      if (!lowered.includes(matcher.literal)) {
        continue;
      }
    }
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
        chars: finish - begin + 1,
        term: matcher.term,
        category: matcher.category,
        why: matcher.why,
        text: echo(text, starts, first, last),
      });
    }
  }
  return { hits, suppressed };
}

/**
 * A filename can be the whole disclosure — a directory named after the client says everything the
 * files inside it were scrubbed of. Path components are matched like any other text and reported
 * with line 0, which is the only position a name has and the value an exemption uses to name one.
 */
function scan_name(node: string, matchers: Matcher[]): Hit[] {
  const name = node.split(/[\\/]/).pop() ?? node;
  return scan_text(node, name, matchers, null).hits.map((hit) => ({ ...hit, line: 0, span: 1, text: node }));
}

/**
 * A phrase whose words fall either side of a directory separator.
 *
 * `vondrel/mikashe-notes.md` discloses exactly what `vondrel mikashe` discloses, and matching one
 * component at a time can never see it, because neither component contains the phrase. So the
 * whole path is matched once more with its separators read as the space they stand in for.
 *
 * Only matches that actually cross a separator are kept. Everything inside a single component was
 * already reported by `scan_name`, and a report that says the same thing twice is a report that
 * gets skimmed.
 */
function scan_path(path: string, matchers: Matcher[]): Hit[] {
  const separators: number[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const character = path[index];
    if (character === "/" || character === "\\") {
      separators.push(index);
    }
  }
  // A path may contain a line break, and a hit's column is then relative to its own line rather
  // than to the path, which is what the crossing test below measures against.
  if (separators.length === 0 || path.includes("\n")) {
    return [];
  }
  const joined = path.replace(/[\\/]/g, " ");
  return scan_text(path, joined, matchers, null)
    .hits.filter((hit) => separators.some((at) => at > hit.column - 1 && at < hit.column - 1 + hit.chars))
    .map((hit) => ({ ...hit, line: 0, span: 1, text: path }));
}

/** Every distinct path and every distinct directory above it, each one matched exactly once. */
function path_nodes(relatives: string[]): string[] {
  const seen = new Set<string>();
  for (const entry of relatives) {
    let prefix = "";
    for (const part of entry.split(/[\\/]/)) {
      if (part === "" || part === ".") {
        continue;
      }
      prefix = prefix === "" ? part : `${prefix}/${part}`;
      seen.add(prefix);
    }
  }
  return [...seen];
}

/**
 * Turns bytes into the text to match, or says they are not text.
 *
 * A NUL in the first few kilobytes used to end the story, which quietly removed every UTF-16 file
 * from the scan: half of a UTF-16 file's bytes are NUL. A byte-order mark settles it outright, and
 * without one the parity of the NULs does — every second byte of UTF-16 ASCII is zero, and which
 * half tells the endianness apart. Anything else is not text in any encoding this knows, and what
 * is still readable inside it is `extract_text`'s problem rather than being dropped.
 */
function decode_bytes(bytes: Uint8Array): { text: string; encoding: string } | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: UTF16.decode(bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: UTF16.decode(swap_bytes(bytes.subarray(2))), encoding: "utf-16be" };
  }
  const window = bytes.subarray(0, BINARY_SNIFF_BYTES);
  if (window.indexOf(0) === -1) {
    return { text: UTF8.decode(bytes), encoding: "utf-8" };
  }
  let even = 0;
  let odd = 0;
  for (let index = 0; index < window.length; index += 1) {
    if (window[index] === 0) {
      if (index % 2 === 0) {
        even += 1;
      } else {
        odd += 1;
      }
    }
  }
  const expected = Math.max(1, Math.floor(window.length / 8));
  if (even === 0 && odd >= expected) {
    return { text: UTF16.decode(bytes), encoding: "utf-16le" };
  }
  if (odd === 0 && even >= expected) {
    return { text: UTF16.decode(swap_bytes(bytes)), encoding: "utf-16be" };
  }
  return null;
}

function swap_bytes(bytes: Uint8Array): Uint8Array {
  const swapped = new Uint8Array(bytes.length - (bytes.length % 2));
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1] as number;
    swapped[index + 1] = bytes[index] as number;
  }
  return swapped;
}

/**
 * The text inside something that is not text.
 *
 * One NUL used to remove a whole file from the scan, and the run still printed PASSED: a plaintext
 * disclosure parked in such a file was invisible, which is a hole rather than a limit. The
 * realistic case is a mostly-text file with one damaged byte, so what is readable is read.
 *
 * Only runs of at least SALVAGE_RUN_CHARACTERS characters survive, and that threshold is what keeps
 * compressed bytes out of the matcher; see the constant.
 *
 * What joins the kept runs is the other half of the defence, and it is not one separator but two.
 * Two runs a megabyte of entropy apart were never one sentence, so a blank line goes between them
 * and no phrase is ever matched over the bytes that were dropped. But two runs a single damaged
 * character apart were adjacent in the file, and a term whose two words fall either side of that
 * character — `vondrel`, one bad byte, `mikashe` — is written there as plainly as if the byte had
 * been a space. A gap of at most SALVAGE_BRIDGE_CHARACTERS therefore joins with a single line
 * break, which is the one break a phrase already crosses. The gap is measured over everything
 * between the two kept runs, damage and discarded short runs alike, so a phrase can never be
 * assembled across text that was read and thrown away.
 *
 * A position inside the result is a line of the extracted text and not of the file, which is why
 * every file read this way is named in the report.
 */
function extract_text(bytes: Uint8Array): string | null {
  const decoded = UTF8.decode(bytes);
  const damage = new RegExp(NOT_TEXT.source, "gu");
  const kept: Array<{ text: string; from: number }> = [];
  let at = 0;
  for (const found of decoded.matchAll(damage)) {
    const starts_at = found.index ?? 0;
    const run = decoded.slice(at, starts_at);
    if (run.length >= SALVAGE_RUN_CHARACTERS) {
      kept.push({ text: run, from: at });
    }
    at = starts_at + found[0].length;
  }
  const tail = decoded.slice(at);
  if (tail.length >= SALVAGE_RUN_CHARACTERS) {
    kept.push({ text: tail, from: at });
  }
  const first = kept[0];
  if (first === undefined) {
    return null;
  }
  let text = first.text;
  let end = first.from + first.text.length;
  for (const run of kept.slice(1)) {
    text += run.from - end <= SALVAGE_BRIDGE_CHARACTERS ? `\n${run.text}` : `\n\n${run.text}`;
    end = run.from + run.text.length;
  }
  return text;
}

/**
 * Bytes as the text to match: decoded outright, or the readable runs of something that is not text,
 * or nothing at all. `salvaged` is what the report has to say out loud, because a file read this way
 * was read in part and a verdict over it is a verdict over less than the file.
 */
function read_text(bytes: Uint8Array): { text: string; encoding: string; salvaged: boolean } | null {
  const decoded = decode_bytes(bytes);
  if (decoded !== null) {
    return { text: decoded.text, encoding: decoded.encoding, salvaged: false };
  }
  const extracted = extract_text(bytes);
  return extracted === null ? null : { text: extracted, encoding: "extracted text", salvaged: true };
}

/**
 * `quoted` maps a dictionary's absolute path to the term strings it necessarily quotes.
 *
 * `contents` is supplied in `--staged` mode, where the bytes that matter are the ones in the index
 * rather than the ones in the working tree. A symlink is read as the path it points at, which is
 * exactly what the repository stores for it and what a scan of the target's own contents would
 * miss when the target is outside the tree.
 *
 * `object_hash` asks for a receipt: the git name of every piece of content that reached the
 * matcher, for the one caller allowed to skip work on the strength of it. Anything this scan did
 * not read leaves no receipt and is therefore not covered — which is the whole rule, and the
 * reason a path absent from a sparse checkout can no longer be mistaken for one that was scanned.
 */
function scan_files(
  paths: string[],
  matchers: Matcher[],
  root: string,
  quoted: Map<string, Set<string>>,
  contents: Map<string, Uint8Array> | null,
  object_hash: string | null,
): ScanResult {
  const hits: Hit[] = [];
  const binary: string[] = [];
  const salvaged: string[] = [];
  const unreadable: string[] = [];
  const blobs = new Set<string>();
  const relatives: string[] = [];
  let scanned = 0;
  let excluded = 0;
  let self_quoted = 0;
  // The receipt is written where the bytes are in hand, before anything decides what they are: a
  // file that turns out not to be text was still read, and the history scan reading the same bytes
  // would reach the same verdict and name it a second time.
  const receipt = (bytes: Uint8Array): void => {
    if (object_hash !== null) {
      blobs.add(blob_id(object_hash, bytes));
    }
  };
  for (const path of paths) {
    const absolute = resolve(path);
    if (absolute.split(sep).includes(".git")) {
      excluded += 1;
      continue;
    }
    const here = relative(root, absolute);
    const label = here === "" || here.startsWith("..") || isAbsolute(here) ? absolute : here.split(sep).join("/");
    relatives.push(label);
    let text: string | null = null;
    const staged = contents?.get(label);
    if (staged !== undefined) {
      receipt(staged);
      const read = read_text(staged);
      if (read === null) {
        binary.push(label);
        continue;
      }
      if (read.salvaged) {
        salvaged.push(label);
      }
      text = read.text;
    } else if (contents !== null) {
      unreadable.push(
        `${label} — listed in the index and nothing readable is staged under it: a stale entry, or a ` +
          "submodule's gitlink",
      );
      continue;
    } else {
      let stats: Stats;
      try {
        stats = lstatSync(absolute);
      } catch {
        unreadable.push(
          `${label} — listed for this scan and not on disk: deleted without being staged, left out of a ` +
            "sparse checkout, or carrying a skip-worktree bit",
        );
        continue;
      }
      if (stats.isSymbolicLink()) {
        text = readlinkSync(absolute);
        // What the repository stores for a symlink is the target string, so the target string is
        // the content and its digest is the name the object graph knows that content by.
        receipt(new TextEncoder().encode(text));
      } else if (!stats.isFile()) {
        unreadable.push(`${label} — not a readable file: a submodule's directory, a stale index entry, or a device`);
        continue;
      } else {
        const bytes = readFileSync(absolute);
        receipt(bytes);
        const read = read_text(bytes);
        if (read === null) {
          binary.push(label);
          continue;
        }
        if (read.salvaged) {
          salvaged.push(label);
        }
        text = read.text;
      }
    }
    scanned += 1;
    const found = scan_text(label, text, matchers, quoted.get(absolute) ?? null);
    hits.push(...found.hits);
    self_quoted += found.suppressed;
  }
  const nodes = path_nodes(relatives);
  for (const node of nodes) {
    hits.push(...scan_name(node, matchers));
  }
  // Once per path, not once per component: a phrase across a separator belongs to the whole path.
  for (const leaf of new Set(relatives)) {
    hits.push(...scan_path(leaf, matchers));
  }
  return { hits, scanned, nodes, blobs, binary, salvaged, unreadable, excluded, self_quoted };
}

function run_git(args: string[], cwd: string, input?: Uint8Array): { ok: boolean; stdout: Buffer; stderr: string } {
  const run = Bun.spawnSync(["git", ...args], {
    cwd,
    stdin: input ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return { ok: run.exitCode === 0, stdout: run.stdout, stderr: run.stderr.toString() };
}

function git_text(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const run = run_git(args, cwd);
  return { ok: run.ok, stdout: run.stdout.toString("utf8"), stderr: run.stderr };
}

function repo_root(cwd: string): string {
  const found = git_text(["rev-parse", "--show-toplevel"], cwd);
  if (!found.ok) {
    throw new Error(`Not inside a git repository: ${cwd}\n${found.stderr.trim()}`);
  }
  return found.stdout.trim();
}

/** Tracked files only, so build output, caches and anything ignored never reach the scanner. */
function list_repository_files(root: string, staged: boolean): string[] {
  const args = staged ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"] : ["ls-files", "-z"];
  const listed = git_text(args, root);
  if (!listed.ok) {
    throw new Error(`Could not list ${staged ? "staged" : "tracked"} files.\n${listed.stderr.trim()}`);
  }
  return listed.stdout
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => join(root, entry));
}

/**
 * Git's name for a piece of content: the hash of the header `blob <length>\0` and the bytes.
 *
 * Hashing what was read is the whole of the skip rule, and it replaced a rule that asked the index
 * instead. The index answers for a *path*, and a tracked scan reads the working tree, so the two
 * disagree in more ways than the obvious one. An unstaged edit was the first found: the scan read
 * the edited copy, the committed blob beside it went unopened, and skipping it as covered cleared
 * a version nobody had looked at. Narrowing the index answer by `git diff` fixed that one case and
 * left its siblings standing — a path left out of a sparse checkout and a path carrying a
 * `skip-worktree` bit are both absent from disk and both *clean* by `git diff`, so their blobs
 * stayed covered while nothing on earth had read them, and the run still printed PASSED.
 *
 * A digest closes the family rather than the case. There is no list of reasons a file might not
 * have been read, and no need for one: either these bytes went through the matcher or they did
 * not, and only the first earns a skip.
 *
 * A working copy that differs from its blob for an innocent reason — a checkout filter, a CRLF
 * conversion — simply does not match, so the committed blob is read in the history scan like any
 * other object. That costs one read and is never wrong in the direction that matters.
 */
function blob_id(algorithm: string, bytes: Uint8Array): string {
  return createHash(algorithm).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/**
 * Which hash this repository names its objects with. A repository initialised with `sha256` names
 * the same bytes differently, so guessing would produce digests that match nothing and quietly
 * cover nothing. `null` when git cannot say, or says something this does not know, and the caller
 * then reads every reachable blob rather than assuming.
 */
function object_format(root: string): string | null {
  const found = git_text(["rev-parse", "--show-object-format"], root);
  const name = found.stdout.trim();
  return found.ok && (name === "sha1" || name === "sha256") ? name : null;
}

/**
 * The object id of every file the index lists — for the scope line, and for nothing else.
 *
 * Nothing is skipped on the strength of this set. What a clearance may skip is what it read, and
 * what it read is hashed as it is read; see `blob_id` and `Covered`. This exists so the report can
 * say how many committed blobs the working-tree pass did not reproduce, which is the number that
 * tells a reader whether they are looking at a clean tree, a dirty one or a sparse one.
 */
function index_blobs(root: string): Set<string> {
  const listed = git_text(["ls-files", "-s", "-z"], root);
  const oids = new Set<string>();
  if (!listed.ok) {
    return oids;
  }
  // `<mode> <object> <stage>\t<path>`, NUL-terminated so a path may contain anything but NUL.
  for (const entry of listed.stdout.split("\0")) {
    const tab = entry.indexOf("\t");
    if (tab === -1) {
      continue;
    }
    const object = entry.slice(0, tab).split(" ")[1];
    if (object !== undefined && object.length > 0) {
      oids.add(object);
    }
  }
  return oids;
}

/**
 * `git cat-file --batch` answers in input order, one record per request, and a record it could not
 * resolve still occupies its place — so the answers are matched to the requests by position rather
 * than by the object id in the header, which for a `:path` request is the resolved id and not the
 * request. Reading a thousand objects this way costs one process instead of a thousand.
 */
function read_objects(root: string, specs: string[]): Array<Uint8Array | null> {
  const answers: Array<Uint8Array | null> = [];
  for (let start = 0; start < specs.length; start += BLOB_BATCH) {
    const chunk = specs.slice(start, start + BLOB_BATCH);
    const run = run_git(["cat-file", "--batch"], root, new TextEncoder().encode(`${chunk.join("\n")}\n`));
    const stdout = run.stdout;
    let position = 0;
    for (let index = 0; index < chunk.length; index += 1) {
      if (position >= stdout.length) {
        answers.push(null);
        continue;
      }
      let end = position;
      while (end < stdout.length && stdout[end] !== 10) {
        end += 1;
      }
      const header = ASCII.decode(stdout.subarray(position, end));
      position = end + 1;
      const fields = header.split(" ");
      const size = fields.length >= 3 ? Number(fields[2]) : Number.NaN;
      if (!Number.isFinite(size) || size < 0) {
        // `<request> missing`, `<request> ambiguous`: no payload follows, and the next record
        // starts immediately.
        answers.push(null);
        continue;
      }
      answers.push(stdout.subarray(position, position + size));
      position += size + 1;
    }
  }
  return answers;
}

/** Types and sizes for every object at once, so only blobs — and only readable ones — are fetched. */
function describe_objects(root: string, oids: string[]): Map<string, { type: string; size: number }> {
  const described = new Map<string, { type: string; size: number }>();
  for (let start = 0; start < oids.length; start += 4096) {
    const chunk = oids.slice(start, start + 4096);
    const run = run_git(["cat-file", "--batch-check"], root, new TextEncoder().encode(`${chunk.join("\n")}\n`));
    for (const line of run.stdout.toString("utf8").split("\n")) {
      const fields = line.split(" ");
      if (fields.length < 3) {
        continue;
      }
      described.set(fields[0] as string, { type: fields[1] as string, size: Number(fields[2]) });
    }
  }
  return described;
}

/**
 * Every path any object was ever stored under, read out of the tree objects themselves.
 *
 * `git rev-list --objects` prints each object once, with the first path it happened to walk it
 * under. Two paths holding identical content are one blob and get one line between them, so the
 * second name is never printed at all — and a file whose *name* is the disclosure escaped the
 * moment its bytes matched something already seen. Deduplicating the printed paths, by path
 * instead of by object, does not help: the line that would have carried the second name does not
 * exist. A tree object, on the other hand, *contains* the names of its own entries, so reading the
 * trees recovers every name in the graph whatever its content turned out to be shared with.
 *
 * The residue, because it is not nothing. Two directories whose contents are byte-identical are
 * one tree object too, walked under one prefix. Every name inside them is still enumerated and
 * every component of both prefixes is still scanned; what is missed is the second prefix's own
 * full path, and with it a phrase that would have to cross the separator between that prefix and
 * a name inside it.
 *
 * A tree entry is `<mode> <name>\0<raw object id>`, and the id is as wide as the repository's hash,
 * which is half the width of the hexadecimal id the entry was requested by.
 */
function tree_names(root: string, trees: string[], prefixes: Map<string, string>): Set<string> {
  const names = new Set<string>();
  for (let start = 0; start < trees.length; start += BLOB_BATCH) {
    const chunk = trees.slice(start, start + BLOB_BATCH);
    for (const [index, body] of read_objects(root, chunk).entries()) {
      const oid = chunk[index] as string;
      if (body === null) {
        continue;
      }
      const prefix = prefixes.get(oid) ?? "";
      const id_bytes = oid.length / 2;
      let at = 0;
      while (at < body.length) {
        const space = body.indexOf(0x20, at);
        const end = space === -1 ? -1 : body.indexOf(0, space + 1);
        if (end === -1) {
          break;
        }
        const name = UTF8.decode(body.subarray(space + 1, end));
        names.add(prefix === "" ? name : `${prefix}/${name}`);
        at = end + 1 + id_bytes;
      }
    }
  }
  return names;
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

/** At least one commit a blob is reachable from, so a hit in the history is something to act on. */
function containing_commit(root: string, oid: string, path: string): string {
  const introduced = git_text(["log", "--all", "--format=%H", "-1", `--find-object=${oid}`], root);
  const first = introduced.ok ? (introduced.stdout.trim().split("\n")[0] ?? "") : "";
  if (first !== "") {
    return first;
  }
  if (path === "") {
    return "";
  }
  const touched = git_text(["log", "--all", "--format=%H", "-1", "--", path], root);
  return touched.ok ? (touched.stdout.trim().split("\n")[0] ?? "") : "";
}

/**
 * Every ref name in the repository: branches, tags of both kinds, remote-tracking names, the
 * stash and the notes refs.
 *
 * A ref name is not in the object graph at all — it is a line in `packed-refs` or a file under
 * `.git/refs` — so walking every reachable object reads none of them, and a branch named after a
 * client is published by the push that carries the branch. Only an annotated tag's name reached
 * this checker before, and only because the tag object happens to repeat it in a header.
 *
 * A name is matched a component at a time, and then once more whole with its separators read as
 * the space they stand in for, exactly as a path in the tree is: `client/feature` discloses what
 * `client feature` discloses, and neither component holds the phrase on its own. Line 0 is the
 * position, because a name has no line, and it is the position an exemption uses to name one.
 */
function scan_refs(root: string, matchers: Matcher[]): { hits: Hit[]; refs: number } {
  const listed = git_text(["for-each-ref", "--format=%(refname)"], root);
  if (!listed.ok) {
    return { hits: [], refs: 0 };
  }
  const names = listed.stdout.split("\n").map((name) => name.trim());
  const hits: Hit[] = [];
  let refs = 0;
  for (const name of names) {
    if (name === "") {
      continue;
    }
    refs += 1;
    const source = `ref ${name}`;
    for (const component of name.split("/")) {
      hits.push(
        ...scan_text(source, component, matchers, null).hits.map((hit) => ({ ...hit, line: 0, span: 1, text: name })),
      );
    }
    hits.push(...scan_path(name, matchers).map((hit) => ({ ...hit, source, text: name })));
  }
  return { hits, refs };
}

/**
 * The clearance. Everything reachable from every ref: the content of every blob, every path any
 * object was ever stored under, every annotated tag's own message, and every commit message —
 * and, because it is published by the same push and is in no object at all, every ref's own name.
 *
 * Blob content is the whole point. A force-push clearance that read only commit messages would
 * report a rewritten history clean while every superseded version of every file still sat in the
 * object database, reachable and cloneable. Blobs are deduplicated by object id, so a file
 * unchanged across five hundred commits is one object, read once and reported once.
 *
 * Paths are deduplicated by path, which is a different question with a different answer. Two paths
 * holding identical content are one blob, and keying the path list on the object id therefore
 * dropped the second name: a file whose *name* was the disclosure escaped the moment its bytes
 * happened to match something already walked — rename a directory and commit both copies, and the
 * new name was never scanned. Content is deduplicated by content and names by name.
 *
 * An annotated tag is an object with a message of its own, and `git push --follow-tags` publishes
 * it beside the commits. Reading commit messages and stopping there left a release note — the one
 * text nobody rewrites — unread.
 *
 * What is skipped is named rather than counted. A blob over the size limit, or one holding no
 * readable text, used to raise a number in the scope line and nothing else, so a disclosure sitting
 * in one left no trace in the report at all.
 *
 * `covered` is what the file scan just read. Reporting the current version of a file a second
 * time, under a `history:` source keyed by line, would make an exempted policy line fail the
 * clearance forever — a gate nobody can ever get green is a gate people stop running. Skipping it
 * leaves exactly the question a clearance asks: what is in the object graph that is not in the tree.
 *
 * That skip is sound only for blobs the file scan genuinely read, and proving it is `main`'s job:
 * every file it opens is hashed the way git hashes it, and only those digests arrive here. What
 * this rules out is a family, not a case. A tracked scan reads the working tree, so an unstaged
 * edit means the committed blob went unopened; a sparse checkout and a `skip-worktree` bit mean
 * there was no file on disk to open at all, and — because both are *clean* by `git diff` — the
 * earlier repair, which subtracted the edited paths from the index listing, waved both straight
 * through. Each of them skipped the one version a push would carry, under a plain PASSED.
 *
 * Reading both versions costs one extra blob per unreproduced file and is always correct, so that
 * is what happens: those blobs arrive here like any other superseded object, and the report tells
 * the two apart by source — the working copy under its own path, the commit under a `history:`
 * label naming the commit. Refusing to clear a dirty tree instead is simpler and unambiguous, and
 * it makes the clearance unusable during exactly the hours a repository is dirty — mid-work, which
 * is when somebody types a client's name — so it would be run less, and a gate that is skipped
 * clears nothing. Nothing is left unscanned, so no run has to invent a verdict for a clearance
 * that stopped halfway.
 *
 * A shallow clone holds only what was fetched, and an explicit range may not resolve in one. Both
 * still run, and both say so in the scope, because a partial history that prints PASSED is the
 * same failure as a partial dictionary that prints PASSED.
 */
function scan_history(root: string, requested: string | null, matchers: Matcher[], covered: Covered): HistoryResult {
  const notes: string[] = [];
  let range = requested;
  let listed = git_text(["rev-list", "--objects", range ?? "--all"], root);
  if (!listed.ok && range !== null) {
    range = null;
    listed = git_text(["rev-list", "--objects", "--all"], root);
    notes.push(`${requested} does not resolve here, so everything reachable was scanned instead`);
  }
  if (!listed.ok) {
    throw new Error(`Could not walk the object graph.\n${listed.stderr.trim()}`);
  }
  const shallow = git_text(["rev-parse", "--is-shallow-repository"], root);
  if (shallow.ok && shallow.stdout.trim() === "true") {
    notes.push("shallow clone, so only the fetched history was available");
  }

  const oids: string[] = [];
  const paths = new Map<string, string>();
  // Every distinct path, kept apart from the object dedupe above: see the note on this function.
  // The label a blob is reported under still names the first path it was found at, because a
  // reader needs one place to look and the content is the same wherever else it sits.
  const walked = new Set<string>();
  for (const line of listed.stdout.split("\n")) {
    if (line.length === 0) {
      continue;
    }
    const space = line.indexOf(" ");
    const oid = space === -1 ? line : line.slice(0, space);
    const path = space === -1 ? "" : line.slice(space + 1);
    if (path !== "") {
      walked.add(path);
    }
    if (paths.has(oid)) {
      continue;
    }
    paths.set(oid, path);
    oids.push(oid);
  }

  const described = describe_objects(root, oids);

  const hits: Hit[] = [];
  for (const path of tree_names(
    root,
    oids.filter((oid) => described.get(oid)?.type === "tree"),
    paths,
  )) {
    walked.add(path);
  }
  const historical = [...walked];
  const nodes = path_nodes(historical).filter((node) => !covered.names.has(node));
  for (const node of nodes) {
    hits.push(...scan_name(`history:${node}`, matchers).map((hit) => ({ ...hit, path: node, text: node })));
  }
  for (const leaf of historical) {
    if (covered.names.has(leaf)) {
      continue;
    }
    hits.push(
      ...scan_path(leaf, matchers).map((hit) => ({ ...hit, source: `history:${leaf}`, path: leaf, text: leaf })),
    );
  }

  const wanted: string[] = [];
  const tag_oids: string[] = [];
  const unread: string[] = [];
  const salvaged: string[] = [];
  let current = 0;
  // A blob's path is how a reader finds it; the object id is how they fetch it when there is none.
  const name_of = (oid: string): string => {
    const path = paths.get(oid) ?? "";
    return `history:${path === "" ? "(no path)" : path} (object ${oid.slice(0, 12)})`;
  };
  for (const oid of oids) {
    const info = described.get(oid);
    if (info === undefined) {
      unread.push(`${name_of(oid)} — git could not say what this object is`);
      continue;
    }
    if (info.type === "tag") {
      tag_oids.push(oid);
      continue;
    }
    if (info.type !== "blob") {
      continue;
    }
    if (covered.blobs.has(oid)) {
      current += 1;
      continue;
    }
    if (info.size > MAX_BLOB_BYTES) {
      unread.push(
        `${name_of(oid)} — ${(info.size / 1024 / 1024).toFixed(1)} MB, over the ` +
          `${MAX_BLOB_BYTES / 1024 / 1024} MB limit, so it was not read at all`,
      );
      continue;
    }
    wanted.push(oid);
  }

  // One chunk of bodies is held at a time: the whole object graph of a repository with any
  // history in it is far larger than the tree, and there is no reason for all of it to be resident.
  let blobs = 0;
  for (let start = 0; start < wanted.length; start += BLOB_BATCH) {
    const chunk = wanted.slice(start, start + BLOB_BATCH);
    const bodies = read_objects(root, chunk);
    for (const [index, body] of bodies.entries()) {
      const oid = chunk[index] as string;
      if (body === null) {
        unread.push(`${name_of(oid)} — git could not read the object`);
        continue;
      }
      const read = read_text(body);
      if (read === null) {
        unread.push(`${name_of(oid)} — not text in any encoding this checker knows, and holding no readable run`);
        continue;
      }
      if (read.salvaged) {
        salvaged.push(`${name_of(oid)} — not text, so only its runs of readable text were matched`);
      }
      blobs += 1;
      const path = paths.get(oid) ?? "";
      const found = scan_text(`history:${path === "" ? oid.slice(0, 12) : path}`, read.text, matchers, null);
      if (found.hits.length === 0) {
        continue;
      }
      const commit = containing_commit(root, oid, path);
      // The commit is a clause of its own and the path travels on the hit, because a path may
      // contain an `@`. Recovering the path by cutting the label at its last `@` read
      // `node_modules/@scope/name` as `node_modules/`, so an exemption written for one path could
      // suppress a hit belonging to another. Nothing parses a label now, and the shape here is the
      // one `name_of` above already uses, so a reader can see where the path ends.
      const label = `history:${path === "" ? "(no path)" : path} (commit ${commit === "" ? "unknown" : commit.slice(0, 12)})`;
      hits.push(
        ...found.hits.map((hit) => (path === "" ? { ...hit, source: label } : { ...hit, source: label, path })),
      );
    }
  }

  let tags = 0;
  for (const [index, body] of read_objects(root, tag_oids).entries()) {
    const oid = tag_oids[index] as string;
    if (body === null) {
      unread.push(`history:(tag object ${oid.slice(0, 12)}) — git could not read it`);
      continue;
    }
    tags += 1;
    const text = UTF8.decode(body);
    // The whole object, headers included: the tagger's name and the tag's own name are as published
    // as the message under them. The name is read from the header block only, because a message
    // line may begin with `tag ` as well.
    const headers = text.slice(0, text.indexOf("\n\n") === -1 ? text.length : text.indexOf("\n\n"));
    const name = TAG_NAME.exec(headers)?.[1]?.trim() ?? oid.slice(0, 12);
    hits.push(...scan_text(`tag ${name}`, text, matchers, null).hits);
  }

  // Ref names are not objects, so the walk above cannot reach them, and a branch named after a
  // client ships with the push that carries the branch. The range does not apply: a ref name has
  // no history, only a current value, and that value is what a clone would receive.
  const named_refs = scan_refs(root, matchers);
  hits.push(...named_refs.hits);

  const logged = git_text(["log", "--format=%B%n%H", range ?? "--all"], root);
  if (!logged.ok) {
    throw new Error(`Could not read commit messages.\n${logged.stderr.trim()}`);
  }
  const commits = parse_commit_messages(logged.stdout);
  for (const commit of commits) {
    hits.push(...scan_text(`commit ${commit.sha.slice(0, 12)}`, commit.message, matchers, null).hits);
  }

  return {
    hits,
    commits: commits.length,
    objects: oids.length,
    blobs,
    current,
    tags,
    unread,
    salvaged,
    names: nodes.length,
    refs: named_refs.refs,
    note: notes.join("; "),
  };
}

/**
 * Git hands the hook the file it is about to strip, not the message it will record: the comment
 * lines are still there, and with `commit.verbose` the whole staged diff is below a scissors line.
 * Scanning either would report the staged content twice and the template's own file list once, so
 * the message is stripped the way git strips it before it is matched.
 */
function strip_commit_message(text: string, comment: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith(comment) && SCISSORS.test(line)) {
      break;
    }
    if (line.startsWith(comment)) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

function comment_character(root: string): string {
  const configured = git_text(["config", "--get", "core.commentChar"], root);
  const value = configured.ok ? configured.stdout.trim() : "";
  return value === "" || value === "auto" || [...value].length !== 1 ? "#" : value;
}

/**
 * Every occurrence of one term in one file of the tree, read once per path and term, and whether
 * the file could be read at all.
 *
 * The second answer is not a detail. A run that cannot open the file an entry names has learnt
 * nothing about that entry, and the two facts it must not confuse are "the sentence has changed"
 * and "I never saw the sentence". Collapsing them made `--path` pointed outside a git repository
 * report every healthy entry in the overlay as anchor-rewritten, because the paths resolved
 * against a root that holds none of them. See `resolve_exemption_contexts`.
 *
 * `contents` is the index when the run is judging the index rather than the working tree, because
 * an exemption has to be resolved against the same bytes the run is reporting on. Reading the
 * working tree there would resolve a sentence the commit is not going to contain.
 */
function file_occurrences(
  root: string,
  path: string,
  matcher: Matcher,
  contents: Map<string, Uint8Array> | null,
  cache: Map<string, { hits: Hit[]; readable: boolean }>,
): { hits: Hit[]; readable: boolean } {
  const key = exemption_key(path, matcher.category, matcher.term);
  const already = cache.get(key);
  if (already !== undefined) {
    return already;
  }
  let found: { hits: Hit[]; readable: boolean } = { hits: [], readable: false };
  try {
    const bytes = contents === null ? readFileSync(join(root, path)) : contents.get(path);
    const read = bytes === undefined ? null : read_text(bytes);
    // Not text and holding no readable run counts as unread here too: there is no sentence to
    // resolve, and saying so is different from saying the sentence changed.
    found = read === null ? found : { hits: scan_text(path, read.text, [matcher], null).hits, readable: true };
  } catch {
    // Absent from this root, or not a file at all: nothing to read a sentence out of.
  }
  cache.set(key, found);
  return found;
}

/**
 * The clauses one entry covers, out of the occurrences its file holds at the line it names.
 *
 * A line can carry the same term more than once, and each occurrence brings its own clause — the
 * forty-eight characters either side of it. Taking all of them let one entry authorise every
 * occurrence on its line, including one nobody had read: the author judged a sentence, the entry
 * quietly covered its neighbour, and no run said so. So an entry that records an `anchor` covers
 * the clause its anchor names and no other, and a second occurrence far enough along the line to
 * read differently needs a second entry with its own anchor. `--audit` prints every digest on the
 * line for exactly that purpose.
 *
 * Two occurrences whose clauses read *identically* — near neighbours on a short line, where each
 * window spans the whole of it — are one sentence twice over, and one judgement covers both. That
 * is the same rule as two identical sentences in two places in the file, not an exception to it:
 * there is nothing a second entry could say that the first does not, and nothing here could tell
 * two identical clauses apart if there were.
 *
 * An entry that records no anchor still covers every clause at its line. It has said nothing about
 * which one it read, so nothing here can narrow it, and narrowing it by guessing would silently
 * drop coverage every overlay written before anchors existed depends on. That is the cost of
 * leaving the field out, it is one more reason to record it, and `--audit` names each entry that
 * has not.
 */
function covered_contexts(occurrences: Hit[], entry: Exemption): { covered: string[]; all: string[] } {
  const all = [...new Set(occurrences.filter((hit) => hit.line === entry.line).map(occurrence_context))];
  return { covered: entry.anchor === "" ? all : all.filter((text) => anchor_digest(text) === entry.anchor), all };
}

/**
 * An exemption covers the occurrence it names, not the term, and the occurrence is a sentence.
 *
 * Keying on path, category and term alone let one entry suppress every occurrence of that spelling
 * in that file for as long as the entry survived, including occurrences written years later by
 * somebody who never read it. Keying on the line instead, with a few lines of tolerance for an
 * edit, moved the same fault a short distance rather than fixing it: an entry written for line 7
 * silently covered a different disclosure at line 5, and `--audit` called that healthy, because
 * the term was still exactly where the entry said it was. Both are one mistake — one person's
 * judgement about one piece of text being spent on another piece of text they never read.
 *
 * So the key is the text. The sentence at the line the entry names is read out of the tree once,
 * in `resolve_exemption_contexts`, and the entry covers that sentence: in the tree wherever an
 * edit has since moved it to, and in the history in every version of the file that carried it.
 * That is what the tolerance was reaching for — an entry that survives an ordinary edit — and the
 * sentence reaches it by following the text instead of guessing how far the text can have gone.
 *
 * The same sentence twice in one file is covered once, by one entry, deliberately. There is
 * nothing a second entry could say that the first does not already say, and nothing in this
 * mechanism could tell two identical clauses apart if there were. Two occurrences in two
 * *different* sentences are two judgements and need two entries, however close together they sit —
 * including two on one line, which is `covered_contexts`.
 *
 * A `line` of 0 names the path itself, which has no sentence and no line of its own, and matches
 * nothing inside the file; a positive `line` matches content and never the path.
 */
function covers(entry: Exemption, hit: Hit): boolean {
  if (entry.line === 0 || hit.line === 0) {
    return entry.line === hit.line;
  }
  return entry.contexts.includes(occurrence_context(hit));
}

/**
 * The sentence around an occurrence, normalised the way matching normalises it and with its
 * whitespace collapsed, so the same sentence reads the same in every version of a file that held
 * it, and a different sentence does not.
 *
 * This is the key an exemption is matched on, in the tree and in the history alike. Ignoring the
 * line was the cure that became the disease: an entry written for a benign policy line covered
 * *any* occurrence of that term at that path, including one that was a real disclosure before
 * somebody cleaned it up. Keying on the line, tolerantly, was the same disease at a shorter range.
 * The line cannot be the key and the term alone is not enough, so what is left is the text.
 */
function occurrence_context(hit: Hit): string {
  const from = Math.max(0, hit.column - 1 - EXEMPTION_CONTEXT_RADIUS);
  const to = hit.column - 1 + Math.max(hit.chars, 1) + EXEMPTION_CONTEXT_RADIUS;
  return normalise(hit.text.slice(from, to)).text.toLowerCase().replace(/\s+/gu, " ").trim();
}

/**
 * The fingerprint an exemption records for the sentence it was written against.
 *
 * `--audit` has the reason, the term and the sentence, and it cannot judge whether the first still
 * describes the last — that is a person's job and no field changes it. What it could not do at all
 * was notice that the sentence had *changed*: rewrite the anchored line into a genuinely different
 * sentence that still carries the term and the entry silently began covering text its `why` no
 * longer described, while the audit printed `ok`. That is the quiet version of the laundering the
 * sentence key was introduced to stop. An entry that records this digest gets the one fact a
 * machine can establish established: the sentence is the one that was judged, or it is not.
 *
 * A digest rather than the sentence itself, because an exemption is a note about a line and must
 * not become a hand-written second copy of the file it points at. A copy drifts, has to be escaped,
 * and republishes the very text a private overlay exists to keep out of a list somebody might read.
 *
 * What it cannot do, so nobody reads more into an `ok`. It proves the sentence is identical after
 * normalisation and says nothing about meaning: a rewrite outside the forty-eight characters either
 * side of the term, or of the paragraph around it, leaves the digest intact and the entry covering
 * an occurrence whose context has changed. It is also optional, so an entry that records none is
 * not checked at all — every overlay written before this existed keeps working, and `--audit` names
 * each unchecked entry and prints the digest to paste in.
 */
function anchor_digest(context: string): string {
  return createHash("sha256").update(context).digest("hex").slice(0, ANCHOR_LENGTH);
}

/**
 * Reads each exemption's own sentence out of the tree, at the line the entry names and nowhere
 * else. The anchor is the whole mechanism.
 *
 * Resolving over a window of nearby lines instead — which is what the tolerance amounted to —
 * collapses straight back into a tolerance: every occurrence inside the window puts its own
 * sentence into the set, so every occurrence inside the window is covered, and a disclosure that
 * lands beside a policy line is laundered exactly as before, sentences or no sentences. Anchoring
 * on the declared line is what makes the sentence mean anything. The entry covers the text
 * somebody actually read and judged, and nothing that has since appeared next to it.
 *
 * The trade-off, plainly. Reword the clause an entry names and its older copies stop being
 * covered. Insert a paragraph above it and the entry names a line that no longer carries the term,
 * so it covers nothing until the number is corrected. Delete the file and every copy stops being
 * covered. In all three the clearance reports the occurrence again and `--audit` prints the line to
 * move the entry to, which is a ten-second fix. That is the direction to fail in: the alternative
 * spends a judgement on text nobody made it about, and says `ok` while it does.
 *
 * A recorded `anchor` is checked here, on every run, and an entry whose anchored sentence has been
 * rewritten resolves to nothing rather than to the new sentence. The caller reports the mismatch as
 * an exemption error, because losing a suppression silently is how the next reader concludes the
 * entry was never needed.
 *
 * An entry whose file this run could not read at all is a third state, and it is not an error.
 * `--path` pointed outside a git repository has no repository root to resolve against, so it
 * resolved every entry against the scanned directory, found none of the files, and announced that
 * all eleven healthy exemptions in the overlay had been rewritten — a false alarm on a legitimate
 * invocation, and the wrong three words for a run that had simply never seen the text. A run that
 * could not open the file has learnt nothing about the entry, so it says that instead, in a list
 * of its own, and does not fail. The direction is safe on its own terms: an entry that resolves to
 * nothing suppresses nothing, so the run reports more than it otherwise would, never less. Whether
 * such an entry is stale is a question for `--audit`, run from the repository the entry names,
 * which fails on exactly that.
 */
function resolve_exemption_contexts(
  root: string,
  exemptions: Exemption[],
  matchers: Matcher[],
  contents: Map<string, Uint8Array> | null,
): { exemptions: Exemption[]; mismatched: string[]; unresolved: string[] } {
  const by_term = new Map(
    matchers.map((matcher) => [`${matcher.category}\u0000${matcher.term.toLowerCase()}`, matcher]),
  );
  const cache = new Map<string, { hits: Hit[]; readable: boolean }>();
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  const resolved = exemptions.map((entry) => {
    const matcher = by_term.get(`${entry.category}\u0000${entry.term.toLowerCase()}`);
    if (entry.line === 0 || matcher === undefined) {
      return entry;
    }
    const occurrences = file_occurrences(root, entry.path, matcher, contents, cache);
    if (!occurrences.readable) {
      unresolved.push(
        `${shorten(entry.source)} (${entry.path}:${entry.line} — ${entry.term}): this run could not read ` +
          `${entry.path} under ${shorten(root)}, so it could not resolve the sentence the entry covers, and ` +
          "the entry suppresses nothing here. Not an error: a run that never saw the text has no opinion " +
          "about it. Run --audit from the repository the entry names to find out whether it is stale.",
      );
      return { ...entry, contexts: [] };
    }
    const { covered, all } = covered_contexts(occurrences.hits, entry);
    if (entry.anchor !== "" && covered.length === 0) {
      const digests = all.map(anchor_digest);
      mismatched.push(
        `${shorten(entry.source)} (${entry.path}:${entry.line} — ${entry.term}): the sentence recorded as ` +
          `\`anchor\` ${entry.anchor} is not the one at that line ` +
          `${digests.length === 0 ? "any more" : `(it now reads ${digests.join(", ")})`}. The entry covers ` +
          "nothing until it is re-read: run --audit, read the sentence standing there now, and record its " +
          "digest only if the same reason still holds.",
      );
      return { ...entry, contexts: [] };
    }
    return { ...entry, contexts: covered };
  });
  return { exemptions: resolved, mismatched, unresolved };
}

function exemption_key(path: string, category: string, term: string): string {
  return `${path}\u0000${category}\u0000${term.toLowerCase()}`;
}

function partition_hits(hits: Hit[], exemptions: Exemption[]): { reported: Hit[]; exempt: Hit[] } {
  const allowed = new Map<string, Exemption[]>();
  for (const entry of exemptions) {
    const key = exemption_key(entry.path, entry.category, entry.term);
    allowed.set(key, [...(allowed.get(key) ?? []), entry]);
  }
  const reported: Hit[] = [];
  const exempt: Hit[] = [];
  for (const hit of hits) {
    // The path travels on the hit; nothing is recovered from the label, which may hold a commit
    // beside a path that itself contains the characters a label puts between them.
    const path = hit.path ?? hit.source;
    const candidates = allowed.get(exemption_key(path, hit.category, hit.term)) ?? [];
    if (candidates.some((entry) => covers(entry, hit))) {
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

/**
 * The verdict word, which has to keep apart two facts one PASSED used to blur: nothing was found in
 * everything the run read, and nothing was found in what it could read while some of it could not be
 * read at all. The exit code stays 0 for the second — bytes nothing can decode are a limit, not a
 * failure — so the wording is the only place the gap can be stated, and it is the line CI keeps.
 */
function verdict_for(hits: Hit[], errors: number, gaps: number): string {
  if (hits.length > 0 || errors > 0) {
    return "FAILED";
  }
  return gaps > 0 ? "PASSED WITH GAPS" : "PASSED";
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

/**
 * What `--require-overlay` actually has to test.
 *
 * The old test was whether a second file had been merged, which an overlay of `{}`, `[]`,
 * `{"categories":[]}` or a category with no terms all satisfy — every one of them printing
 * `0 terms`, silencing the missing-overlay advisory and exiting 0, which is precisely the state
 * the flag exists to refuse, moved up one level. A secret rotated to `{}` reaches CI as a
 * non-empty value and passes the only check the workflow can make, so the check that matters has
 * to be here: terms loaded, not files merged.
 */
function overlay_shortfall(dictionaries: Dictionary[], matchers: Matcher[]): string | null {
  if (matchers.length > 0) {
    return null;
  }
  const overlays = dictionaries.filter((entry) => entry.path !== BUILT_IN_TERMS);
  const opening =
    overlays.length === 0
      ? "--require-overlay was given and no overlay dictionary was merged."
      : `--require-overlay was given and the ${overlays.length} merged ${overlays.length === 1 ? "overlay" : "overlays"} ` +
        `(${overlays.map((entry) => shorten(entry.path)).join(", ")}) declared no terms at all.`;
  return (
    `${opening}\n` +
    "The dictionary shipped here declares no vocabulary, so this run would have checked no name, no " +
    "figure and no domain word, printed PASSED and exited 0 — the same exit code as a complete run. " +
    "Merge an overlay that declares terms with --terms <path> or LEAK_TERMS."
  );
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
  if (loaded.reduce((sum, entry) => sum + entry.terms, 0) === 0) {
    console.log(
      "  No vocabulary loaded (--terms <path>, LEAK_TERMS). The dictionary shipped here declares none of " +
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
  /**
   * Everything the run could not read: not text in any encoding, or absent, or not a file at all.
   * Each entry names itself and says why, because a count leaves no trace of what was missed, and
   * every one of them is a gap in the verdict.
   */
  unread: string[];
  /** Not text, but holding runs that are: matched in part, so named as covered in part. */
  partial: string[];
  /** Exemptions this run could not resolve, because it could not read the file they name. */
  unresolved: string[];
  quiet: boolean;
  dictionaries: Dictionary[];
};

/**
 * The header scrolls away on a long run and CI keeps the last line, so the verdict repeats how much
 * vocabulary backed it. A pass earned by half a dictionary has to say so where it is read, and so
 * does a pass earned over content nothing could read: everything unread or read in part is named
 * here, and the verdict word says which of the two kinds of clean run this was.
 */
function report({
  reported,
  exempt,
  exemptions,
  rejected,
  scope,
  unread,
  partial,
  unresolved,
  quiet,
  dictionaries,
}: Verdict): void {
  if (!quiet) {
    const ordered = [...reported].sort(
      (left, right) => left.source.localeCompare(right.source) || left.line - right.line || left.column - right.column,
    );
    for (const hit of ordered) {
      const text = hit.text.trimEnd();
      const spans = hit.span > 1 ? ` [spans ${hit.span} lines]` : "";
      const at = hit.line === 0 ? "name" : `${hit.line}`;
      console.log(`${hit.source}:${at}:${hit.column}: ${hit.term} (${hit.category})${spans} — ${hit.why}`);
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

  if (unread.length > 0) {
    console.log("");
    console.log(
      `Not read — nothing was matched in ${unread.length} ` +
        `${unread.length === 1 ? "file or blob" : "files and blobs"}, each named here with the reason it ` +
        "could not be read:",
    );
    for (const path of unread) {
      console.log(`  ${path}`);
    }
  }

  if (partial.length > 0) {
    console.log("");
    console.log(
      `Read in part — ${partial.length} ${partial.length === 1 ? "file or blob" : "files and blobs"} not text, but ` +
        "holding runs that are; those runs were matched and the bytes between them were not. A line reported in one " +
        "of these is a line of the extracted text, not of the file:",
    );
    for (const path of partial) {
      console.log(`  ${path}`);
    }
  }

  if (unresolved.length > 0) {
    console.log("");
    const names = unresolved.length === 1 ? "entry names a file" : "entries name files";
    console.log(
      `Exemptions not resolved — ${unresolved.length} ${names} this run could not read, so nothing was ` +
        "suppressed on their account. Not an error, and not a gap in coverage: an entry that resolves to " +
        "nothing makes this run report more, never less.",
    );
    // The summary above carries the count, which is all a gate needs. Each line below names the
    // entry's own term and the path it points at, both of them the overlay's content, so they are
    // held behind the same guard as the hit lines: a CI log on a public repository is not a place
    // to print the dictionary, and this block was outside that guard while the hits were inside it.
    if (!quiet) {
      for (const failure of unresolved) {
        console.log(`  ${failure}`);
      }
    }
  }

  console.log("");
  console.log(
    `Exemptions: ${exemptions} active, ${exempt.length} ${exempt.length === 1 ? "hit" : "hits"} suppressed. ` +
      "Run --audit to read every reason and catch the stale ones.",
  );
  if (rejected.length > 0) {
    console.log(`Exemption errors: ${rejected.length}.`);
    if (!quiet) {
      for (const failure of rejected) {
        console.log(`  ${failure}`);
      }
    }
  }

  console.log("");
  const backing = `Checked with ${describe_dictionaries(dictionaries)} and ${exemptions} active ${exemptions === 1 ? "exemption" : "exemptions"}.`;
  const gaps = unread.length + partial.length;
  const verdict = verdict_for(reported, rejected.length, gaps);
  if (verdict === "PASSED") {
    console.log(`PASSED — no unexempted term found across ${scope}. ${backing}`);
    return;
  }
  if (verdict === "PASSED WITH GAPS") {
    console.log(
      `PASSED WITH GAPS — no unexempted term found in what could be read across ${scope}, and ` +
        `${gaps} ${gaps === 1 ? "file or blob" : "files and blobs"} could not be read in full: ` +
        `${unread.length} not at all, ${partial.length} in part, each one named above. ${backing} ` +
        "A term inside what could not be read would not have been found.",
    );
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
 * is where a real leak eventually hides, so an entry that no longer covers anything fails the
 * audit rather than sitting quietly.
 *
 * The distinction this has to draw, and the whole value of keying on the sentence, is between an
 * entry that still covers the occurrence it was written for and one that has drifted onto a
 * different occurrence. The old audit could not draw it: it asked whether the term was still near
 * the line, and a term that had been replaced by a different disclosure at the same place answered
 * yes. So `ok` now means the line still carries the sentence the entry names, and `DRIFTED` means
 * the line carries something else — the entry suppresses nothing, the hit is back, and somebody has
 * to read the new occurrence before deciding it is the same judgement.
 *
 * An `ok` entry also says what else it covers and what it does not. A sentence that appears twice
 * is covered twice by one entry, which is stated rather than left to be discovered; an occurrence
 * of the same term in a different sentence, which no entry covers, is named here as well, because
 * that is the entry a reader is about to assume exists. "A different sentence" is counted by
 * clause and not by line: two occurrences on one line are two clauses unless they read the same,
 * so an entry anchored on the first of them is told, here, that the second is uncovered. Counting
 * by line hid exactly that, and hid it from the one report written to find it.
 *
 * The audit is also where the history side of an entry is kept honest. An entry whose file is gone,
 * or whose term has left it, no longer covers anything in the history either, because the sentence a
 * history hit is matched against is read from the tree — so the state this reports is the state the
 * clearance will act on.
 *
 * The one drift it cannot see on its own is a rewrite: change the anchored line into a different
 * sentence that still carries the term and the entry goes on covering text its reason no longer
 * describes, with `ok` printed beside it. An entry that records an `anchor` has that checked, and
 * `REWRITTEN` says the line still carries the term while the words around it are not the ones
 * somebody judged. An entry that records none is named as unchecked, with the digest to paste in:
 * a field nobody can be compelled to write is worth more as a prompt than as a rejection. Neither
 * state is a judgement about meaning — no digest can be one.
 */
function audit_allowlist(
  root: string,
  exemptions: Exemption[],
  rejected: string[],
  matchers: Matcher[],
  quiet: boolean,
): number {
  const by_key = new Map(
    matchers.map((matcher) => [`${matcher.category}\u0000${matcher.term.toLowerCase()}`, matcher]),
  );
  const cache = new Map<string, { hits: Hit[]; readable: boolean }>();
  const matcher_for = (entry: Exemption): Matcher | undefined =>
    by_key.get(`${entry.category}\u0000${entry.term.toLowerCase()}`);

  // Which clauses the entries for one path, category and term cover between them, so an occurrence
  // no entry has judged is named once rather than once for every entry that does not cover it.
  // Clauses rather than lines: an entry covers text, and a line may carry more of it than the
  // entry ever read.
  const judged = new Map<string, Set<string>>();
  for (const entry of exemptions) {
    const matcher = matcher_for(entry);
    if (matcher === undefined || entry.line === 0) {
      continue;
    }
    const key = exemption_key(entry.path, entry.category, entry.term);
    const { covered } = covered_contexts(file_occurrences(root, entry.path, matcher, null, cache).hits, entry);
    // An entry anchored on a sentence that is no longer there resolves to no clause at all, so it
    // judges nothing and contributes nothing here.
    const clauses = judged.get(key) ?? new Set<string>();
    for (const context of covered) {
      clauses.add(context);
    }
    judged.set(key, clauses);
  }

  let stale = 0;
  let drifted = 0;
  let rewritten = 0;
  let unanchored = 0;
  let uncovered = 0;
  const sources = [...new Set(exemptions.map((entry) => shorten(entry.source)))];
  console.log("");
  console.log(
    `Exemptions: ${exemptions.length} active, ${rejected.length} rejected` +
      `${sources.length === 0 ? "" : ` — from ${sources.join(", ")}`}`,
  );
  console.log("");
  for (const entry of exemptions) {
    const absolute = join(root, entry.path);
    const matcher = matcher_for(entry);
    const notes: string[] = [];
    let status = "ok";
    if (!existsSync(absolute)) {
      status = "STALE — the file no longer exists";
    } else if (matcher === undefined) {
      status = `STALE — no loaded dictionary defines ${entry.term} in category ${entry.category}`;
    } else if (entry.line === 0) {
      if (scan_name(entry.path, [matcher]).length === 0) {
        status = "STALE — the path no longer contains this term";
      }
    } else if (!statSync(absolute).isFile()) {
      status = "STALE — the path is a directory, so it has no line to cover";
    } else {
      const occurrences = file_occurrences(root, entry.path, matcher, null, cache).hits;
      const { covered, all } = covered_contexts(occurrences, entry);
      const at = (hits: Hit[]): string => [...new Set(hits.map((hit) => hit.line))].sort((a, b) => a - b).join(", ");
      if (occurrences.length === 0) {
        status =
          read_text(readFileSync(absolute)) === null
            ? "STALE — the file is not text and holds no readable run, so nothing in it can be matched"
            : "STALE — the file no longer contains this term";
      } else if (all.length === 0) {
        status =
          `DRIFTED — written for line ${entry.line}, which no longer carries this term; it is now at ` +
          `${at(occurrences)}. This entry covers the sentence it was written for, and that sentence has ` +
          "gone, so it suppresses nothing and the hit is back. Read the occurrence above and move the " +
          "entry to it only if the same reason still holds.";
      } else {
        const digests = all.map(anchor_digest);
        if (covered.length === 0) {
          status =
            `REWRITTEN — line ${entry.line} still carries this term, but not in the sentence this entry was ` +
            `written against: it records anchor ${entry.anchor} and the line now reads ${digests.join(", ")}. ` +
            "It covers nothing until somebody reads the sentence standing there now; if the same reason still " +
            "holds, copy the digest above into `anchor`. A digest can say the words changed and nothing about " +
            "what they mean, so this one needs a person.";
        } else {
          if (entry.anchor === "") {
            unanchored += 1;
            notes.push(
              `no \`anchor\` recorded, so a rewording of this line is not checked; record ` +
                `"anchor": "${digests[0] ?? ""}"`,
            );
          }
          if (all.length > 1) {
            // One line, more than one clause. Which of them an entry covers is the anchor's job,
            // so an unanchored entry here is covering text nobody ever pointed it at.
            const reach =
              entry.anchor === ""
                ? "with no `anchor` this entry covers all of them, which is one judgement spent on text it " +
                  "never named — record the anchor of the one that was read and give the others entries of " +
                  "their own"
                : "this entry covers only the one it anchors, and each of the others needs an entry of its own";
            notes.push(
              `line ${entry.line} carries this term in ${all.length} clauses that read differently ` +
                `(${digests.join(", ")}); ${reach}`,
            );
          }
          const clauses = new Set(covered);
          const twins = occurrences.filter((hit) => hit.line !== entry.line && clauses.has(occurrence_context(hit)));
          if (twins.length > 0) {
            notes.push(`covers the same sentence again at line ${at(twins)}; one judgement, one entry`);
          }
          const group = judged.get(exemption_key(entry.path, entry.category, entry.term));
          const loose = occurrences.filter((hit) => !(group?.has(occurrence_context(hit)) ?? false));
          if (loose.length > 0) {
            uncovered += loose.length;
            notes.push(
              `line ${at(loose)} carries this term in a different sentence and no entry covers it, so the ` +
                "clearance reports it: judge it and give it an entry of its own",
            );
          }
        }
      }
    }
    if (status.startsWith("STALE")) {
      stale += 1;
    } else if (status.startsWith("DRIFTED")) {
      drifted += 1;
    } else if (status.startsWith("REWRITTEN")) {
      rewritten += 1;
    }
    // Every line below names the entry's term, its category, the path it covers and the reason
    // somebody wrote for it — the overlay's content, four ways. `--audit` is the mode whose whole
    // output is the dictionary, so on a public repository's CI log it is the worst of the three to
    // run loud. The counts and the verdict survive; read the reasons where the overlay lives.
    if (quiet) {
      continue;
    }
    // The flag is the first word of the status, so a state cannot be added without one.
    const flag = status === "ok" ? "ok" : (status.split(" ")[0] as string);
    const indent = " ".repeat(13);
    const where = entry.line === 0 ? "name" : `${entry.line}`;
    console.log(`  ${flag.padEnd(9)}  ${entry.path}:${where} — ${entry.term} (${entry.category})`);
    console.log(`${indent}${entry.why}`);
    if (status !== "ok") {
      console.log(`${indent}${status}`);
    }
    for (const note of notes) {
      console.log(`${indent}${note}`);
    }
  }
  if (!quiet) {
    for (const failure of rejected) {
      console.log(`  REJECTED   ${failure}`);
    }
  }
  console.log("");
  const loose =
    uncovered === 0
      ? ""
      : ` ${uncovered} ${uncovered === 1 ? "occurrence" : "occurrences"} at an exempted path ` +
        `${uncovered === 1 ? "is" : "are"} covered by no entry and named above; the clearance reports them.`;
  const unchecked =
    unanchored === 0
      ? ""
      : ` ${unanchored} ${unanchored === 1 ? "entry records" : "entries record"} no \`anchor\`, so a rewrite of ` +
        `${unanchored === 1 ? "that line" : "those lines"} into a different sentence carrying the same term is ` +
        "the one drift this audit cannot see; the digest to record is printed beside each of them.";
  if (stale === 0 && drifted === 0 && rewritten === 0 && rejected.length === 0) {
    console.log(`Audit PASSED — every exemption still covers the occurrence it was written for.${loose}${unchecked}`);
    return 0;
  }
  console.log(
    `Audit FAILED — ${drifted} drifted onto a different occurrence, ${rewritten} anchored on a sentence that has ` +
      `since been rewritten, ${stale} stale, ${rejected.length} rejected.${loose}${unchecked} Delete what no ` +
      "longer applies, re-read what has drifted or changed before moving it, and give every remaining entry a " +
      "reason.",
  );
  return 1;
}

type Fixture = { file: string; body: string | Uint8Array; expect: string[] };

/**
 * A throwaway repository for the history fixtures. It carries, deliberately:
 *
 * - a file committed and then deleted, which is the clearance itself;
 * - one path holding two occurrences of one term, a disclosure and a policy line, where the policy
 *   line survives into the tree at a different line number and the disclosure does not;
 * - a blob over the size limit, committed and then deleted, so the skip has something to name;
 * - an annotated tag whose message carries a term, because a tag is pushed with the branch;
 * - a branch whose name carries a term, and a lightweight tag whose name carries a phrase either
 *   side of a separator. Neither name is in any object, and both travel with a push.
 * - a file committed with a term in it and then edited on disk and left unstaged, which is the
 *   version a tracked scan reads standing beside the version a push would carry;
 * - a file committed with a term in it, marked `skip-worktree` and removed from disk, which is
 *   what a sparse checkout looks like from here: tracked, listed, absent, and *clean* by
 *   `git diff`, so every rule that asked the index called its blob covered;
 * - two paths holding byte-identical content, one of them named after a term. They are one blob,
 *   so a path list keyed on the object id never reaches the second name.
 */
function plant_history(directory: string): string {
  const repository = join(directory, "history-fixture");
  mkdirSync(repository, { recursive: true });
  const commit = (message: string): void => {
    const run = Bun.spawnSync(
      [
        "git",
        "-c",
        "user.email=self-test@example.invalid",
        "-c",
        "user.name=self test",
        "commit",
        "--no-verify",
        "--quiet",
        "-m",
        message,
      ],
      { cwd: repository, stdout: "pipe", stderr: "pipe" },
    );
    if (run.exitCode !== 0) {
      throw new Error(`self-test could not commit: ${run.stderr.toString()}`);
    }
  };
  Bun.spawnSync(["git", "init", "--quiet", "-b", "main", repository], { stdout: "pipe", stderr: "pipe" });
  writeFileSync(join(repository, "was-here.txt"), "a term that was later deleted: zarquilon\n");
  // Two occurrences of one term at one path: a disclosure on line 1, a policy line on line 3.
  writeFileSync(
    join(repository, "policy.md"),
    "the private engagement's own brulq belongs to nobody else\nan ordinary line\nthe policy list names brulq as prohibited\n",
  );
  // Over MAX_BLOB_BYTES, so the clearance has to name what it did not read.
  writeFileSync(
    join(repository, "oversized.txt"),
    `a term nothing will read: zarquilon\n${"filler text that compresses well\n".repeat(300000)}`,
  );
  Bun.spawnSync(["git", "add", "-A"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
  commit("plant the term");
  rmSync(join(repository, "was-here.txt"));
  rmSync(join(repository, "oversized.txt"));
  // The policy line moves well past the exemption's line tolerance, and the disclosure above it goes.
  writeFileSync(
    join(repository, "policy.md"),
    "a heading\n\nsome prose\nmore prose\nanother line\nand one more\nthe policy list names brulq as prohibited\n",
  );
  writeFileSync(join(repository, "clean.txt"), "nothing to see here\n");
  // Committed with a term in it, and edited on disk further down without being staged. A tracked
  // scan reads the working copy, so this file's committed blob is one that scan never opened.
  writeFileSync(join(repository, "unstaged.txt"), "a line the commit still carries: zarquilon\n");
  // Two paths, one blob. The content is identical and innocuous; the second path's *name* is the
  // disclosure, and it is the name that has to survive the object dedupe. Both are deleted below,
  // so only the history walk can find them, and the clean name sorts first inside the tree.
  mkdirSync(join(repository, "shared"), { recursive: true });
  writeFileSync(join(repository, "shared", "dup-a-clean.txt"), "identical bytes under two names\n");
  writeFileSync(join(repository, "shared", "dup-b-zarquilon.txt"), "identical bytes under two names\n");
  // Committed with a term in it, then hidden the way a sparse checkout hides a path: the index
  // entry stays, the file leaves the disk, and `git diff` reports nothing at all.
  writeFileSync(join(repository, "sparse.txt"), "a line only the index still carries: zarquilon\n");
  Bun.spawnSync(["git", "add", "-A"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
  commit("remove it again, the way a scrub would");
  // Both duplicate names leave the tree, so only the object graph still holds either of them.
  rmSync(join(repository, "shared"), { recursive: true });
  Bun.spawnSync(["git", "add", "-A"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
  commit("drop the duplicate names");
  const hidden = Bun.spawnSync(["git", "update-index", "--skip-worktree", "sparse.txt"], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (hidden.exitCode !== 0) {
    throw new Error(`self-test could not set skip-worktree: ${hidden.stderr.toString()}`);
  }
  rmSync(join(repository, "sparse.txt"));
  const tagged = Bun.spawnSync(
    [
      "git",
      "-c",
      "user.email=self-test@example.invalid",
      "-c",
      "user.name=self test",
      "tag",
      "-a",
      "-m",
      "a release note naming zarquilon",
      "fixture-1.0",
    ],
    { cwd: repository, stdout: "pipe", stderr: "pipe" },
  );
  if (tagged.exitCode !== 0) {
    throw new Error(`self-test could not tag: ${tagged.stderr.toString()}`);
  }
  for (const ref of [
    // A branch named after the work, which is how a client's name reaches a remote without ever
    // being written into a file.
    ["branch", "zarquilon-cleanup"],
    // A lightweight tag, which has no object of its own at all: the name is the whole of it, and
    // the phrase in it falls either side of the separator.
    ["tag", "vondrel/mikashe-cut"],
  ] as Array<[string, string]>) {
    const made = Bun.spawnSync(["git", ref[0], ref[1]], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    if (made.exitCode !== 0) {
      throw new Error(`self-test could not create ${ref[0]} ${ref[1]}: ${made.stderr.toString()}`);
    }
  }
  // The unstaged edit itself: scrubbed on disk, intact in the object graph, staged nowhere.
  writeFileSync(join(repository, "unstaged.txt"), "a line with nothing in it at all\n");
  return repository;
}

/**
 * Proves the checker against fixtures it writes itself, so the result never depends on what the
 * repository happens to contain today, and works with no dictionary loaded at all: the vocabulary
 * it plants is invented here, names nobody, and would be a disclosure in no repository.
 *
 * Every term of every loaded category is planted, not a sample of one per category, because a
 * pattern that fails to match its own term fails in exactly one term at a time.
 *
 * Every evasion that used to work gets a fixture, and the ones with a shape the gate must *not*
 * fire on get a control beside them.
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
      {
        file: "bypass-fullwidth.txt",
        body: "Every letter fullwidth: \uff5a\uff41\uff52\uff51\uff55\uff49\uff4c\uff4f\uff4e\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-one-fullwidth-letter.txt",
        body: "One fullwidth letter inside a plain word: zarq\uff55ilon\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-mathematical.txt",
        body: "Mathematical sans-serif letters: \u{1d5d3}\u{1d5ba}\u{1d5cb}\u{1d5ca}\u{1d5ce}\u{1d5c2}\u{1d5c5}\u{1d5c8}\u{1d5c7}\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-ligature.txt",
        body: "The fi ligature inside a word: nuv\ufb01lax\n",
        expect: ["nuvfilax"],
      },
      {
        file: "bypass-cyrillic.txt",
        body: "A Cyrillic a and o standing in for Latin: z\u0430rquil\u043en\n",
        expect: ["zarquilon"],
      },
      {
        file: "bypass-greek.txt",
        body: "A Greek omicron and alpha standing in for Latin: z\u03b1rquil\u03bfn\n",
        expect: ["zarquilon"],
      },
      {
        file: "boundary-snake-case.txt",
        body: "An underscore separates tokens: foo_brulq_bar\n",
        expect: ["brulq"],
      },
      {
        file: "boundary-camel-case.txt",
        body: "An identifier: const value = getBrulqValue(input);\n",
        expect: ["brulq"],
      },
      {
        file: "boundary-plural.txt",
        body: "A regular plural and a possessive: brulqs, brulqes, brulq's\n",
        expect: ["brulq"],
      },
      {
        file: "zarquilon-in-the-filename.txt",
        body: "This body is deliberately clean. The disclosure is the name of the file.\n",
        expect: [],
      },
      {
        file: "utf-16le.txt",
        body: new Uint8Array(Buffer.from("\ufeffA term in UTF-16: zarquilon\n", "utf16le")),
        expect: ["zarquilon"],
      },
    );

    // A file whose body is clean and whose name is the whole disclosure.
    const named_file = "zarquilon-in-the-filename.txt";

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
        file: "control-all-caps.txt",
        body: `${bounded.map((term) => `X${term.toUpperCase()}X`).join(" ")}\n`,
        forbid: bounded,
      },
      {
        file: "control-blank-line.txt",
        body: "vondrel\n\nmikashe\n",
        forbid: ["vondrel mikashe"],
      },
    ];

    for (const fixture of planted) {
      writeFileSync(join(directory, fixture.file), fixture.body as string);
    }
    for (const fixture of controls) {
      writeFileSync(join(directory, fixture.file), fixture.body);
    }

    // A directory whose name is the disclosure, and a symlink whose target is.
    mkdirSync(join(directory, "vondrel-mikashe"), { recursive: true });
    writeFileSync(join(directory, "vondrel-mikashe", "inner.txt"), "a clean file under a dirty directory\n");
    symlinkSync("../elsewhere/zarquilon-notes.md", join(directory, "link-to-elsewhere"));

    // A phrase split by a directory separator: it is in neither component on its own.
    mkdirSync(join(directory, "vondrel"), { recursive: true });
    writeFileSync(
      join(directory, "vondrel", "mikashe-notes.md"),
      "a body with nothing in it; the path is the finding\n",
    );

    // What an exemption in the tree has to get right, in one file. Line 6 is the policy line an
    // entry is written for. Line 3, three lines above it, is a different sentence and a real
    // disclosure — the tolerance used to swallow it silently. Line 8 repeats line 6 word for word,
    // and one judgement covers both copies of one sentence.
    const exempted_file = "exempted-policy.md";
    writeFileSync(
      join(directory, exempted_file),
      [
        "a heading for the fixture",
        "an ordinary line",
        "the engagement's own brulq belongs to nobody else",
        "another ordinary line",
        "and one more ordinary line",
        "the policy list names brulq as prohibited",
        "a line standing between the two policy lines",
        "the policy list names brulq as prohibited",
        "",
      ].join("\n"),
    );

    // One line, two occurrences of one term. On line 1 they are far enough apart that each brings
    // its own clause, so they are two sentences and two judgements; on line 2 they are near
    // enough that both clauses are the whole line, which is one sentence written twice.
    const two_clauses = "two-clauses.md";
    writeFileSync(
      join(directory, two_clauses),
      [
        "the policy list names brulq as prohibited, and further along the very same line, past a good " +
          "deal of intervening prose, an unrelated remark names brulq a second time",
        "brulq beside brulq",
        "",
      ].join("\n"),
    );

    // Binary in every encoding this checker knows: NULs at both parities, so it is not UTF-16, and
    // its one readable run is fifteen characters, a single character under the salvage threshold.
    // The term in it must NOT be reported: a short run inside entropy is where a three-letter term
    // starts matching random bytes, and the threshold is the only thing standing between the two.
    writeFileSync(
      join(directory, "really-binary.bin"),
      new Uint8Array([0x89, 0x50, 0x00, 0x00, 0x4e, 0x47, 0x00, 0x01, 0x00, 0x02, ...Buffer.from("zarquilon fifte")]),
    );

    // The realistic case behind the binary skip: text with one stray NUL in it. Every readable run
    // is extracted and matched, so a plaintext disclosure parked here is not invisible.
    writeFileSync(
      join(directory, "one-stray-nul.md"),
      new Uint8Array([
        ...Buffer.from(`${"a paragraph of ordinary prose, long enough to be worth keeping. ".repeat(2)}\n`),
        0x00,
        ...Buffer.from(`a line below the damage naming zarquilon, ${"padded so this run is kept too. ".repeat(2)}\n`),
      ]),
    );

    // A disclosure shorter than a sentence, inside a file that is not text. Twenty-seven characters
    // behind NULs at both parities: over the salvage threshold, well under what it used to be, and
    // the shape that used to land in "Not read" while the run exited 0.
    writeFileSync(
      join(directory, "short-plaintext.bin"),
      new Uint8Array([
        0x00,
        0x01,
        0x00,
        0x02,
        0x03,
        0x00,
        ...Buffer.from("zarquilon parked in binary."),
        0x00,
        0x04,
        0x00,
      ]),
    );

    // A phrase whose two words fall either side of one damaged byte. The words were adjacent in
    // the file, so the runs are joined by a single line break and the phrase is caught.
    writeFileSync(
      join(directory, "damaged-phrase.bin"),
      new Uint8Array([
        ...Buffer.from("a run of prose long enough to keep, ending in vondrel"),
        0x00,
        ...Buffer.from("mikashe opens the next run, also long enough to keep.\n"),
      ]),
    );

    // The control beside it: the same two words with a stretch of dropped bytes between them. They
    // were never one phrase, and joining across what was thrown away invents one that nobody wrote.
    writeFileSync(
      join(directory, "severed-phrase.bin"),
      new Uint8Array([
        ...Buffer.from("a run of prose long enough to keep, ending in vondrel"),
        ...new Uint8Array(64),
        ...Buffer.from("mikashe opens the next run, also long enough to keep.\n"),
      ]),
    );

    const result = scan_files(walk_path(directory), matchers, directory, new Map(), null, null);
    const found = new Map<string, Set<string>>();
    for (const hit of result.hits) {
      const seen = found.get(hit.source) ?? new Set<string>();
      seen.add(`${hit.line === 0 ? "name:" : ""}${hit.term}`);
      found.set(hit.source, seen);
    }
    const caught = (source: string, term: string): boolean => found.get(source)?.has(term) ?? false;

    for (const fixture of planted) {
      for (const term of fixture.expect) {
        if (!caught(fixture.file, term)) {
          failures.push(`${fixture.file}: planted term not found: ${term}`);
        }
      }
    }
    for (const fixture of controls) {
      for (const term of fixture.forbid) {
        if (caught(fixture.file, term)) {
          failures.push(`${fixture.file}: control matched a term it must not: ${term}`);
        }
      }
    }
    if (!caught(named_file, "name:zarquilon")) {
      failures.push("a term in a filename was not reported");
    }
    if (caught(named_file, "zarquilon")) {
      failures.push("a clean file was reported as if its body carried the term");
    }
    if (!caught("vondrel-mikashe", "name:vondrel mikashe")) {
      failures.push("a term in a directory name was not reported");
    }
    if (!caught("link-to-elsewhere", "zarquilon")) {
      failures.push("a symlink whose target names a term was not scanned");
    }
    if (!result.binary.includes("really-binary.bin")) {
      failures.push("a genuinely binary file was not counted and named as unread");
    }
    if (result.binary.includes("utf-16le.txt")) {
      failures.push("a UTF-16 file was dropped as binary instead of decoded");
    }

    // A plaintext disclosure inside a file that sniffs as binary, and a verdict that says so.
    if (!caught("one-stray-nul.md", "zarquilon")) {
      failures.push("a plaintext term in a file with one stray NUL was not matched, which is the binary hole");
    }
    if (!result.salvaged.includes("one-stray-nul.md")) {
      failures.push("a file read only for its runs of text was not named as read in part");
    }
    if (result.binary.includes("one-stray-nul.md")) {
      failures.push("a mostly-text file with one stray NUL was dropped from the scan as binary");
    }
    if (caught("really-binary.bin", "zarquilon")) {
      failures.push("a term inside a run too short to be text was matched, which is how a gate starts crying wolf");
    }

    // A short plaintext disclosure inside a file that is not text. The threshold is a measured
    // number rather than a round one, and this is the length it was lowered to be able to reach.
    if (!caught("short-plaintext.bin", "zarquilon")) {
      failures.push(
        `a ${"zarquilon parked in binary.".length}-character plaintext disclosure behind NULs was not read, ` +
          `and the salvage threshold is ${SALVAGE_RUN_CHARACTERS}`,
      );
    }
    if (!result.salvaged.includes("short-plaintext.bin")) {
      failures.push("a short run read out of a binary file was not named as read in part");
    }

    // A phrase either side of one damaged byte is one phrase; either side of a stretch of dropped
    // bytes it is two words that were never written together, and matching them is inventing text.
    if (!caught("damaged-phrase.bin", "vondrel mikashe")) {
      failures.push("a phrase whose two words fall either side of one damaged byte was not matched");
    }
    if (caught("severed-phrase.bin", "vondrel mikashe")) {
      failures.push("a phrase was assembled across dropped bytes, which invents text nobody wrote");
    }
    if (verdict_for([], 0, 0) !== "PASSED") {
      failures.push("a clean run over everything it read did not print a plain PASSED");
    }
    if (verdict_for([], 0, result.binary.length) !== "PASSED WITH GAPS") {
      failures.push("a run that could not read a file still printed the same verdict as a complete one");
    }
    if (verdict_for(result.hits, 0, 0) !== "FAILED" || verdict_for([], 1, 3) !== "FAILED") {
      failures.push("a hit or a rejected exemption did not outrank the coverage gap in the verdict");
    }

    // A multi-word term whose words fall either side of a directory separator.
    if (!caught("vondrel/mikashe-notes.md", "name:vondrel mikashe")) {
      failures.push("a phrase split across a directory separator was not matched");
    }
    if (result.hits.some((hit) => hit.source === "vondrel-mikashe/inner.txt" && hit.term === "vondrel mikashe")) {
      failures.push("the cross-separator pass reported a phrase that sits inside one component, twice over");
    }

    // A phrase followed by a long run of separators used to take quadratic time to fail.
    const started = Date.now();
    scan_text("backtracking", `vondrel${" \t_-".repeat(8000)}!`, matchers, null);
    const elapsed = Date.now() - started;
    if (elapsed > 2000) {
      failures.push(`a long run of phrase separators took ${elapsed}ms, which is the old quadratic failure`);
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

    // An exemption covers one category and one sentence — not every occurrence of one spelling,
    // and not whatever else happens to be standing nearby.
    const policy_line = "the policy list names brulq as prohibited";
    const shared: Hit = {
      source: "fixture.md",
      line: 1,
      column: 24,
      span: 1,
      chars: 5,
      term: "brulq",
      category: "self_test_fixture",
      why: "",
      text: policy_line,
    };
    const elsewhere: Hit = { ...shared, category: "self_test_other_category" };
    const moved: Hit = { ...shared, line: 400 };
    const different: Hit = { ...shared, line: 4, column: 36, text: "the engagement's own brulq belongs to nobody" };
    const in_the_name: Hit = { ...shared, line: 0 };
    const entry: Exemption = {
      path: "fixture.md",
      category: "self_test_fixture",
      term: "brulq",
      line: 1,
      why: "fixture",
      source: "self-test",
      anchor: "",
      contexts: [occurrence_context(shared)],
    };
    const split = partition_hits([shared, elsewhere, moved, different, in_the_name], [entry]);
    if (!split.exempt.some((hit) => hit === shared)) {
      failures.push("an exemption did not suppress the occurrence it names");
    }
    if (!split.reported.some((hit) => hit.category === "self_test_other_category")) {
      failures.push("an exemption suppressed a category it does not name");
    }
    if (!split.exempt.some((hit) => hit === moved)) {
      failures.push("an exemption did not follow its own sentence to the line an edit moved it to");
    }
    if (!split.reported.some((hit) => hit === different)) {
      failures.push("an exemption suppressed a different sentence, which is the laundering it exists to prevent");
    }
    if (!split.reported.some((hit) => hit.line === 0)) {
      failures.push("an exemption written for a line suppressed a hit in the path");
    }

    // The same rule end to end, against a file on disk rather than hand-built hits: the sentence
    // comes out of the tree at the line the entry names, and everything else follows from it.
    const anchored_entry: Exemption = {
      path: exempted_file,
      category: "self_test_fixture",
      term: "brulq",
      line: 6,
      why: "fixture",
      source: "self-test",
      anchor: "",
      contexts: [],
    };
    const in_the_tree = resolve_exemption_contexts(directory, [anchored_entry], matchers, null);
    const exempted_hits = result.hits.filter((hit) => hit.source === exempted_file);
    const tree = partition_hits(exempted_hits, in_the_tree.exemptions);
    if (in_the_tree.exemptions[0]?.contexts.length !== 1) {
      failures.push("an exemption read something other than the one sentence at the line it names");
    }
    if (!tree.exempt.some((hit) => hit.line === 6)) {
      failures.push("an exemption did not cover the occurrence at the line it was written for");
    }
    if (!tree.exempt.some((hit) => hit.line === 8)) {
      failures.push("an exemption did not cover the second copy of the sentence it names, in the same file");
    }
    if (!tree.reported.some((hit) => hit.line === 3)) {
      failures.push(
        "an exemption written for line 6 suppressed a different disclosure three lines above it, which is " +
          "the laundering the line tolerance did in this repository until it was removed",
      );
    }

    // And an entry whose own line has lost the term covers nothing at all, rather than sliding
    // sideways onto whichever occurrence happens to be closest.
    const adrift = resolve_exemption_contexts(directory, [{ ...anchored_entry, line: 4 }], matchers, null);
    if (adrift.exemptions[0]?.contexts.length !== 0) {
      failures.push("an exemption whose line carries no occurrence still resolved a sentence from somewhere");
    }
    if (partition_hits(exempted_hits, adrift.exemptions).exempt.length !== 0) {
      failures.push("an exemption whose line has lost its term drifted onto a neighbouring occurrence");
    }

    // An entry may record a digest of the sentence it was written against, and that digest is
    // checked on every run: rewrite the anchored line into a different sentence carrying the same
    // term and the entry covers nothing, rather than quietly covering the new sentence instead.
    const judged_sentence = in_the_tree.exemptions[0]?.contexts[0] ?? "";
    const anchored_here = resolve_exemption_contexts(
      directory,
      [{ ...anchored_entry, anchor: anchor_digest(judged_sentence) }],
      matchers,
      null,
    );
    if (anchored_here.mismatched.length !== 0 || anchored_here.exemptions[0]?.contexts.length !== 1) {
      failures.push("an exemption recording the digest of its own sentence was refused");
    }
    const rewritten = resolve_exemption_contexts(
      directory,
      [{ ...anchored_entry, anchor: anchor_digest("a sentence that was never in the file") }],
      matchers,
      null,
    );
    if (rewritten.mismatched.length !== 1 || rewritten.exemptions[0]?.contexts.length !== 0) {
      failures.push("an exemption anchored on a sentence its line no longer carries still resolved that line");
    }
    if (partition_hits(exempted_hits, rewritten.exemptions).exempt.length !== 0) {
      failures.push("a rewritten anchor line was still suppressed, which is the laundering an anchor exists to stop");
    }
    const digest = anchor_digest("any sentence at all");
    const shapes = read_exemptions("self-test", [
      { path: "x.md", category: "self_test_fixture", term: "brulq", line: 1, why: "fixture", anchor: "nope" },
      { path: "x.md", category: "self_test_fixture", term: "brulq", line: 0, why: "fixture", anchor: digest },
      { path: "x.md", category: "self_test_fixture", term: "brulq", line: 1, why: "fixture" },
    ]);
    if (shapes.rejected.length !== 2 || shapes.exemptions.length !== 1 || shapes.exemptions[0]?.anchor !== "") {
      failures.push("a malformed anchor, or one on a path exemption, was applied instead of rejected");
    }

    // Two occurrences on one line. Each brings its own clause, so an entry anchored on the first
    // covers the first and leaves the second reported: an anchor names a sentence, and nobody has
    // read the other one. An entry that records no anchor cannot say which it read, so it keeps
    // both — which is the cost of leaving the field out, stated rather than discovered.
    const clause_entry: Exemption = {
      path: two_clauses,
      category: "self_test_fixture",
      term: "brulq",
      line: 1,
      why: "fixture",
      source: "self-test",
      anchor: "",
      contexts: [],
    };
    const clause_hits = result.hits.filter((hit) => hit.source === two_clauses && hit.term === "brulq");
    const first_line = clause_hits.filter((hit) => hit.line === 1);
    const unanchored_line = resolve_exemption_contexts(directory, [clause_entry], matchers, null);
    if (first_line.length !== 2 || unanchored_line.exemptions[0]?.contexts.length !== 2) {
      failures.push("two occurrences far apart on one line did not read as two clauses, so the fixture proves nothing");
    }
    if (partition_hits(first_line, unanchored_line.exemptions).reported.length !== 0) {
      failures.push("an entry recording no anchor stopped covering the line it names");
    }
    const one_clause = resolve_exemption_contexts(
      directory,
      [{ ...clause_entry, anchor: anchor_digest(unanchored_line.exemptions[0]?.contexts[0] ?? "") }],
      matchers,
      null,
    );
    const by_clause = partition_hits(first_line, one_clause.exemptions);
    if (one_clause.mismatched.length !== 0 || by_clause.exempt.length !== 1 || by_clause.reported.length !== 1) {
      failures.push(
        "an entry anchored on one clause of a line authorised the other occurrence as well, which is one " +
          "judgement spent on a sentence nobody read",
      );
    }
    // And the other way: two occurrences whose clauses read the same are one sentence twice over,
    // covered by one entry, exactly as two identical sentences on two lines are.
    const twin_clause = resolve_exemption_contexts(directory, [{ ...clause_entry, line: 2 }], matchers, null);
    const second_line = clause_hits.filter((hit) => hit.line === 2);
    if (second_line.length !== 2 || twin_clause.exemptions[0]?.contexts.length !== 1) {
      failures.push("two occurrences sharing one clause on a short line read as two sentences");
    }
    if (partition_hits(second_line, twin_clause.exemptions).reported.length !== 0) {
      failures.push("one entry did not cover both occurrences of the one clause its line carries");
    }

    // An entry whose file this run could not read at all is unresolved, and unresolved is not
    // rewritten. `--path` pointed outside a git repository resolves every entry against a root
    // that holds none of them, and used to announce that every healthy entry had been reworded.
    const outside = join(directory, "not-a-repository");
    mkdirSync(outside, { recursive: true });
    const unreadable_here = resolve_exemption_contexts(
      outside,
      [{ ...clause_entry, anchor: anchor_digest(unanchored_line.exemptions[0]?.contexts[0] ?? "") }],
      matchers,
      null,
    );
    if (unreadable_here.unresolved.length !== 1 || unreadable_here.mismatched.length !== 0) {
      failures.push("an entry naming a file this run could not read was reported as an anchor somebody rewrote");
    }
    if (unreadable_here.exemptions[0]?.contexts.length !== 0) {
      failures.push("an entry resolved a sentence out of a file that was never read");
    }

    // A historical path may contain an `@`. Recovering the path from the label by cutting at its
    // last `@` read `assets@2x/vondrel-mikashe.png` as `assets`, so an exemption written for one
    // path suppressed a hit belonging to another. The path travels on the hit instead.
    const scoped: Hit = {
      source: "history:assets@2x/vondrel-mikashe.png",
      path: "assets@2x/vondrel-mikashe.png",
      line: 0,
      column: 11,
      span: 1,
      chars: 15,
      term: "vondrel mikashe",
      category: "self_test_fixture",
      why: "",
      text: "assets@2x/vondrel-mikashe.png",
    };
    const other_path: Exemption = {
      path: "assets",
      category: "self_test_fixture",
      term: "vondrel mikashe",
      line: 0,
      why: "fixture",
      source: "self-test",
      anchor: "",
      contexts: [],
    };
    if (partition_hits([scoped], [other_path]).exempt.length !== 0) {
      failures.push("an exemption for an unrelated path suppressed a hit whose own path contains an @");
    }
    if (partition_hits([scoped], [{ ...other_path, path: "assets@2x/vondrel-mikashe.png" }]).exempt.length !== 1) {
      failures.push("an exemption naming a path that contains an @ did not cover the hit in that path");
    }

    // --require-overlay tests loaded vocabulary, not a merged file.
    const empty_overlay: Dictionary[] = [
      { path: BUILT_IN_TERMS, terms: 0, categories: 0, merged: [], duplicates: 0, exemptions: 0 },
      { path: "/outside/leak-terms.json", terms: 0, categories: 0, merged: [], duplicates: 0, exemptions: 0 },
    ];
    if (overlay_shortfall(empty_overlay, []) === null) {
      failures.push("--require-overlay accepted an overlay that declared no terms");
    }
    if (overlay_shortfall([], []) === null) {
      failures.push("--require-overlay accepted a run with no dictionary at all");
    }
    if (overlay_shortfall(empty_overlay, matchers) !== null) {
      failures.push("--require-overlay rejected a run that did load vocabulary");
    }

    // A malformed overlay fails the run rather than loading as an empty one.
    for (const [name, body] of [
      ["broken.json", "{ not json"],
      ["array.json", "[]"],
      ["scalar.json", "42"],
      ["bad-categories.json", '{"categories": {}}'],
    ] as Array<[string, string]>) {
      const path = join(directory, name);
      writeFileSync(path, body);
      let refused = false;
      try {
        parse_dictionary(path);
      } catch {
        refused = true;
      }
      if (!refused) {
        failures.push(`a malformed overlay (${name}) loaded as an empty dictionary instead of failing the run`);
      }
    }

    // The clearance finds a blob that no ref's tree still points at.
    const nothing_covered: Covered = { blobs: new Set(), names: new Set() };
    const repository = plant_history(directory);
    const history = scan_history(repository, null, matchers, nothing_covered);
    if (!history.hits.some((hit) => hit.term === "zarquilon" && hit.path === "was-here.txt")) {
      failures.push("the history scan did not find a deleted file's blob, which is the whole clearance");
    }
    if (!history.hits.some((hit) => / \(commit [0-9a-f]{12}\)$/.test(hit.source))) {
      failures.push("a history hit did not name a commit that contains it");
    }
    if (history.blobs < 2) {
      failures.push(`the history scan read ${history.blobs} blobs, so it is not walking the object graph`);
    }
    // A historical path is scanned even when its blob is one another path already supplied. The
    // two duplicates are one object; the second name is the disclosure, and deduplicating paths by
    // object id meant it was never matched at all.
    if (!history.hits.some((hit) => hit.path === "shared/dup-b-zarquilon.txt" && hit.line === 0)) {
      failures.push(
        "a historical path was never scanned because an earlier path held identical content: content is " +
          "deduplicated by content, and a name is not content",
      );
    }

    // The two halves as `main` runs them: the tracked scan reads the working tree and hands the
    // clearance the digest of every byte it actually read, and the clearance skips on that
    // evidence alone. The fixture disagrees with its own index in two ways at once — a file
    // carrying an unstaged edit, and a file hidden behind a skip-worktree bit the way a sparse
    // checkout hides one.
    const object_hash = object_format(repository);
    if (object_hash === null) {
      failures.push("git could not say which hash names this repository's objects, so nothing could be proved read");
    }
    const tracked = scan_files(
      list_repository_files(repository, false),
      matchers,
      repository,
      new Map(),
      null,
      object_hash,
    );
    const proved = scan_history(repository, null, matchers, {
      blobs: tracked.blobs,
      names: new Set(tracked.nodes),
    });
    if (proved.current === 0) {
      failures.push("nothing was skipped as already read, so the receipt covers nothing and the scope line lies");
    }
    if (!proved.hits.some((hit) => hit.path === "was-here.txt")) {
      failures.push("skipping what was read also hid a superseded blob, which is the clearance itself");
    }
    if (!proved.hits.some((hit) => hit.path === "unstaged.txt" && hit.term === "zarquilon")) {
      failures.push("the committed version of an unstaged edit went unscanned, so a dirty tree cleared nothing");
    }
    // The one this rule was rewritten for. `sparse.txt` is tracked, listed, absent from disk, and
    // clean by `git diff`, so nothing read it and nothing ever could — and it was skipped anyway.
    if (!proved.hits.some((hit) => hit.path === "sparse.txt" && hit.term === "zarquilon")) {
      failures.push(
        "a tracked file absent under a skip-worktree bit was skipped as already read, so its committed " +
          "version cleared a disclosure nothing had opened",
      );
    }
    // The rule this replaced, over the same fixture, so the fixture is known to prove something:
    // asking the index covered both files, and both went unread under a plain PASSED.
    const by_the_index = scan_history(repository, null, matchers, {
      blobs: index_blobs(repository),
      names: new Set(),
    });
    if (by_the_index.hits.some((hit) => hit.path === "sparse.txt" || hit.path === "unstaged.txt")) {
      failures.push("the sparse and unstaged fixtures prove nothing: the index rule caught them too");
    }
    if (!by_the_index.hits.some((hit) => hit.path === "was-here.txt")) {
      failures.push("the index comparison read nothing at all, so it is not the rule this replaced");
    }
    // What could not be read is named, not counted, and it is a gap in the verdict — the same
    // treatment a file read only in part already had, for the stronger of the two cases.
    if (!tracked.unreadable.some((entry) => entry.startsWith("sparse.txt "))) {
      failures.push("a tracked file nothing could read was counted without being named");
    }
    if (verdict_for([], 0, tracked.unreadable.length) !== "PASSED WITH GAPS") {
      failures.push("a file that could not be read at all left the verdict word unchanged");
    }
    // And a file that was read leaves a receipt git agrees with, or every skip above is a
    // coincidence: the digest of the bytes on disk is the object id the index lists for them.
    const clean_blob = blob_id(object_hash ?? "sha1", readFileSync(join(repository, "clean.txt")));
    if (!index_blobs(repository).has(clean_blob)) {
      failures.push("the digest of a file this scan read is not the name git gives that content");
    }
    const staged_only = scan_history(repository, null, build_matchers([]), nothing_covered);
    if (staged_only.hits.length !== 0) {
      failures.push("the history scan reported hits with no vocabulary loaded");
    }

    // An annotated tag carries its own message object, and a tag is pushed with the branch.
    if (history.tags === 0) {
      failures.push("the clearance read no annotated tag objects at all");
    }
    if (!history.hits.some((hit) => hit.source.startsWith("tag ") && hit.term === "zarquilon")) {
      failures.push("an annotated tag's message was not scanned, and a tag is as published as a commit");
    }

    // A ref name is published by the push that carries it and is in no object at all, so the walk
    // over the object graph cannot reach one.
    if (history.refs === 0) {
      failures.push("the clearance read no ref names, so a branch named after a client goes out with the push");
    }
    if (!history.hits.some((hit) => hit.source === "ref refs/heads/zarquilon-cleanup" && hit.line === 0)) {
      failures.push("a term in a branch name was not reported, and a branch name ships with the branch");
    }
    const phrase_ref = "ref refs/tags/vondrel/mikashe-cut";
    if (!history.hits.some((hit) => hit.source === phrase_ref && hit.term === "vondrel mikashe")) {
      failures.push("a phrase split across a separator in a ref name was not matched");
    }

    // A blob too large to read is named, not merely counted: a number leaves no trace of the gap.
    if (!history.unread.some((entry) => entry.includes("oversized.txt"))) {
      failures.push("a historical blob over the size limit was skipped without being named");
    }
    if (history.hits.some((hit) => hit.source.includes("oversized.txt"))) {
      failures.push("the oversized fixture was read after all, so it proves nothing about the skip");
    }

    // An exemption written for a line in the tree covers its own sentence in every version of its
    // file, and nothing else that has ever stood at that path.
    const policy = resolve_exemption_contexts(
      repository,
      [
        {
          path: "policy.md",
          category: "self_test_fixture",
          term: "brulq",
          line: 7,
          why: "fixture",
          source: "self-test",
          anchor: "",
          contexts: [],
        },
      ],
      matchers,
      null,
    );
    if (policy.exemptions[0]?.contexts.length !== 1) {
      failures.push("an exemption did not read the one sentence it names out of the tree");
    }
    const historic = partition_hits(
      history.hits.filter((hit) => hit.path === "policy.md" && hit.line > 0),
      policy.exemptions,
    );
    if (!historic.exempt.some((hit) => hit.text.includes("policy list names"))) {
      failures.push("an exempted policy line failed the clearance in an older version of its own file");
    }
    if (!historic.reported.some((hit) => hit.text.includes("belongs to nobody else"))) {
      failures.push("a historical disclosure was laundered by an exemption written for a different line");
    }
    if (historic.exempt.some((hit) => hit.text.includes("belongs to nobody else"))) {
      failures.push("a disclosure at an exempted path was suppressed by that path's exemption");
    }
    if (historic.reported.some((hit) => hit.text.includes("policy list names"))) {
      failures.push("the exempted sentence was reported in a historical copy that carries it verbatim");
    }

    // A commit message is stripped the way git strips it before it is matched.
    const message = strip_commit_message(
      "a subject line\n\n# a comment naming zarquilon\n# ------------------------ >8 ------------------------\ndiff --git a/x b/x containing zarquilon\n",
      "#",
    );
    if (message.includes("zarquilon")) {
      failures.push("a commit message was matched with its comments and its verbose diff still attached");
    }
    if (!strip_commit_message("keep zarquilon\n# drop this\n", "#").includes("zarquilon")) {
      failures.push("stripping a commit message also removed the message");
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
        `${controls.length} controls, ${bounded.length} whole-word ${bounded.length === 1 ? "term" : "terms"} ` +
        `buried in the boundary control, ${result.scanned} files and ${result.nodes.length} path components ` +
        `scanned, ${result.salvaged.length} read only for the runs of text in them, ${result.binary.length} ` +
        `unread, ${tracked.blobs.size} tracked ${tracked.blobs.size === 1 ? "blob" : "blobs"} proved read and ` +
        `${tracked.unreadable.length} named unreadable in the fixture repository, ${history.blobs} historical ` +
        `blobs, ${history.refs} ref ${history.refs === 1 ? "name" : "names"}, ${history.tags} tag ` +
        `${history.tags === 1 ? "message" : "messages"} and ${history.unread.length} named ` +
        `${history.unread.length === 1 ? "skip" : "skips"} across ${history.commits} commits, ` +
        `phrase separators cleared in ${elapsed}ms.`,
    );
    if (failures.length > 0) {
      // Counts and categories, never the terms themselves, and not conditional on `--quiet`.
      //
      // With an overlay merged the self-test plants every term of every loaded category, so a
      // failure loop that printed each message would print the whole private vocabulary — 42 terms
      // across four categories, measured. This repository is public and its CI logs are
      // world-readable, so a broken matcher would publish the words the dictionary exists to keep
      // out. Note which way that cuts: a secret rotated to `{}` is safe here and a *working*
      // overlay is the dangerous one, which is the opposite of the intuition.
      //
      // Unconditional rather than behind the flag, because a flag can be dropped from a workflow
      // by someone who does not know this, and because a failing self-test means the checker is
      // broken — a fact that needs no vocabulary to state. Re-run locally, where the overlay
      // already lives, to read which terms went missing.
      console.log(
        `  ${failures.length} self-test ${failures.length === 1 ? "check" : "checks"} failed. ` +
          "Re-run locally with the overlay merged to read which.",
      );
      console.log("Self-test FAILED — the checker does not do what it claims.");
      return 1;
    }
    console.log(
      "Self-test PASSED — every term is found where it was planted; a decomposed, wrapped, zero-width-broken, " +
        "percent-encoded, fullwidth, mathematical, ligatured, Cyrillic or Greek spelling is caught; a term in a " +
        "filename, a directory name, a phrase split across a directory separator, a symlink target, a UTF-16 " +
        "file, the readable runs of a file with one stray NUL, a short plaintext run behind NULs, a phrase " +
        "either side of one damaged byte, a branch name, a lightweight tag name, an annotated tag's message, " +
        "a deleted file's historical blob and a historical path whose blob another path already supplied are " +
        "all caught; the clearance skips only blobs whose bytes this run hashed as it read them, so the " +
        "committed version of a file carrying an unstaged edit and of one hidden behind a skip-worktree bit " +
        "are both read here rather than skipped, where the index rule they replaced skipped both; a run one " +
        "character under the salvage threshold, a phrase either side of dropped bytes, and every control are " +
        "not; an exemption covers the sentence at the line it names — both copies of it, wherever an edit has " +
        "moved them, in the tree and in every version the history holds, and both occurrences of it where one " +
        "line carries the clause twice — and covers neither a different sentence three lines away, nor the " +
        "second clause of its own line once it anchors the first, nor anything at all once its own line has " +
        "lost the term or has been rewritten out from under a recorded anchor, nor a hit whose historical path " +
        "merely shares a prefix with its own up to an @; an entry whose file this run could not read is " +
        "unresolved rather than rewritten; a blob too large to read is named; a file that could not be read " +
        "at all is named and changes the verdict; an empty or malformed overlay fails --require-overlay; and " +
        "a hit exits 1.",
    );
    return 0;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Everything that is not a real directory is handed to the scanner, symlinks included, and the
 * scanner decides what each one is. Recursing only into real directories is what keeps a symlink
 * loop from turning the walk into an infinite one, and listing the symlink itself is what keeps it
 * from being dropped from the scan and from the count at the same time.
 */
function walk_path(target: string): string[] {
  if (!lstatSync(target).isDirectory()) {
    return [target];
  }
  const found: string[] = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES[entry.name] === undefined) {
        found.push(...walk_path(join(target, entry.name)));
      }
      continue;
    }
    found.push(join(target, entry.name));
  }
  return found;
}

/**
 * The bytes a commit will actually contain. Reading the working tree instead let a clean staged
 * version pass while the dirty file on disk was the one read, and the reverse: `git add` a clean
 * file, edit it, and the gate reported on text that was never going to be committed.
 */
function staged_contents(root: string, files: string[]): Map<string, Uint8Array> {
  const relatives = files.map((path) => relative(root, path).split(sep).join("/"));
  const readable = relatives.filter((path) => !path.includes("\n"));
  const bodies = read_objects(
    root,
    readable.map((path) => `:${path}`),
  );
  const contents = new Map<string, Uint8Array>();
  for (const [index, body] of bodies.entries()) {
    if (body !== null) {
      contents.set(readable[index] as string, body);
    }
  }
  return contents;
}

function print_usage(): void {
  console.log(
    [
      "Usage: bun scripts/leak-check.ts [options]",
      "",
      "Scans this repository for vocabulary that belongs to private work. Exits 1 on any hit.",
      "The vocabulary itself is not in this repository: merge a project's overlay to load one.",
      "",
      "  (no options)          scan every tracked file, and every tracked path, as it is on disk",
      "  --staged              scan the staged content and paths only, for a pre-commit gate",
      "  --path <p>            scan one file or directory instead of the repository",
      "  --message <file>      scan a commit message file, for a commit-msg gate",
      "  --history [<range>]   also clear the history: every blob, path, ref name, tag message and",
      "                        commit message reachable from every ref (default), or from <range>",
      "  --terms <path>        merge an overlay dictionary; repeatable",
      "  --require-overlay     fail unless vocabulary was loaded; use it wherever this is a gate",
      "  --audit               list every exemption with its reason and flag the stale ones",
      "  --self-test           prove the checker against planted fixtures and exit",
      "  --quiet               print only the summaries, not each hit",
      "  --help                print this text",
      "",
      "  LEAK_TERMS            colon-separated overlay dictionaries, merged before --terms",
      "",
      "A run without --history has not looked at the history. Only --history clears a force-push.",
    ].join("\n"),
  );
}

function parse_arguments(argv: string[]): Options {
  const options: Options = {
    mode: "tracked",
    history: false,
    history_range: null,
    path: null,
    message: null,
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
    } else if (argument === "--path" || argument === "--terms" || argument === "--message") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${argument} needs a path.`);
      }
      if (argument === "--terms") {
        options.terms.push(value);
      } else if (argument === "--message") {
        options.mode = "message";
        options.message = value;
      } else {
        options.mode = "path";
        options.path = value;
      }
      index += 1;
    } else if (argument === "--history") {
      options.history = true;
      const value = argv[index + 1];
      if (value !== undefined && !value.startsWith("-")) {
        options.history_range = value;
        index += 1;
      }
    } else if (argument === "--commits") {
      throw new Error(
        "--commits is gone. It read commit messages and nothing else, so it cleared a force-push by " +
          "checking the one part of the history a scrub never touches. --history walks every blob, every " +
          "path and every message reachable from every ref.",
      );
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

    if (options.require_overlay) {
      const shortfall = overlay_shortfall(dictionaries, matchers);
      if (shortfall !== null) {
        throw new Error(shortfall);
      }
    }

    if (options.mode === "self_test") {
      return self_test(categories);
    }

    if (options.mode === "audit") {
      return audit_allowlist(repo_root(import.meta.dir), exemptions, rejected, matchers, options.quiet);
    }

    if (options.message !== null) {
      const root = repo_root(import.meta.dir);
      const text = strip_commit_message(readFileSync(options.message, "utf8"), comment_character(root));
      const { reported, exempt } = partition_hits(scan_text("commit message", text, matchers, null).hits, exemptions);
      report({
        reported,
        exempt,
        exemptions: exemptions.length,
        rejected,
        scope: "the commit message, with its comments and any verbose diff stripped as git strips them",
        unread: [],
        partial: [],
        unresolved: [],
        quiet: options.quiet,
        dictionaries,
      });
      return exit_code_for(reported, rejected.length);
    }

    let root: string;
    let files: string[];
    const scopes: string[] = [];

    if (options.path !== null) {
      const target = resolve(options.path);
      const base = statSync(target).isDirectory() ? target : dirname(target);
      // Report paths relative to the repository, not to the scanned subtree, so an exemption
      // written once matches whether the run covered one directory or every tracked file.
      const found = git_text(["rev-parse", "--show-toplevel"], base);
      root = found.ok ? found.stdout.trim() : base;
      files = walk_path(target);
      if (!found.ok) {
        // Said out loud, because every exemption in the overlay names a path inside a repository
        // and there is no repository here to name it inside. They will not resolve, the run will
        // list them as unresolved, and a reader who has not been told why reads eleven healthy
        // entries reported as broken.
        console.log(
          `  ${shorten(target)} is not inside a git repository, so paths are reported relative to ` +
            `${shorten(root)} and any exemption naming a repository path cannot be resolved here.`,
        );
      }
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

    // Only a full tracked scan can promise that the current version of every file was already read
    // with its exemptions applied, so only that run asks for the digests that let the clearance
    // skip a blob. Anything narrower assumes nothing and re-reads it all.
    const full = options.history && options.mode === "tracked" && options.path === null;
    const object_hash = full ? object_format(root) : null;
    const contents = options.mode === "staged" ? staged_contents(root, files) : null;
    const result = scan_files(files, matchers, root, quoted, contents, object_hash);
    const hits = [...result.hits];
    const unread = [
      ...result.binary.map(
        (path) => `${path} — not text in any encoding this checker knows, and holding no readable run`,
      ),
      ...result.unreadable,
    ];
    const partial = [...result.salvaged];
    // Coverage is part of the verdict, and a deliberate suppression is not the same fact as a file
    // that could not be read: one is a measured blind spot, the other is a gap nobody chose.
    const coverage =
      `${result.nodes.length} path components, ` +
      `${result.binary.length} not text and named above, ` +
      `${result.salvaged.length} not text but read for the runs that are, and named above, ` +
      `${result.unreadable.length} absent or not a readable file, and named above, ` +
      `${result.excluded} excluded by path, ` +
      `${result.self_quoted} ${result.self_quoted === 1 ? "occurrence" : "occurrences"} suppressed inside the ` +
      "dictionary that declares them";
    const files_noun = result.scanned === 1 ? "file" : "files";
    const where =
      options.path !== null
        ? `${files_noun} under ${options.path}`
        : `${options.mode === "staged" ? "staged" : "tracked"} ${files_noun}`;
    scopes.push(`${result.scanned} ${where} (${coverage})`);

    if (options.history) {
      // What the clearance may skip is what this run proved it read: the digest of the bytes that
      // went through the matcher, never the index's word for a path. See `blob_id` and `Covered`.
      const covered: Covered = { blobs: result.blobs, names: full ? new Set(result.nodes) : new Set() };
      const scanned = scan_history(repo_root(root), options.history_range, matchers, covered);
      hits.push(...scanned.hits);
      unread.push(...scanned.unread);
      partial.push(...scanned.salvaged);
      const note = scanned.note === "" ? "" : `, ${scanned.note}`;
      // What was skipped is part of the verdict: a reader has to be able to tell a blob that was
      // read upstairs from one that was merely assumed read, and a clean tree from a dirty or a
      // sparse one. The index is asked here and nowhere else, and only to count.
      let dirt = "";
      if (full && object_hash === null) {
        dirt = "; git could not say which hash names its objects, so no blob was assumed already read";
      } else if (full) {
        const missed = [...index_blobs(root)].filter((oid) => !covered.blobs.has(oid)).length;
        const blobs = missed === 1 ? "blob" : "blobs";
        const read = missed === 1 ? "it was" : "they were";
        dirt =
          missed === 0
            ? "; every blob the index lists was read from the working tree above"
            : `; ${missed} committed ${blobs} the index lists ${missed === 1 ? "was" : "were"} not among the ` +
              "bytes read from the working tree — an unstaged edit, a path left out of a sparse checkout or " +
              `carrying a skip-worktree bit, a file that could not be opened — so ${read} read here rather ` +
              "than skipped";
      }
      scopes.push(
        `${scanned.blobs} superseded ${scanned.blobs === 1 ? "blob" : "blobs"} of ${scanned.objects} reachable ` +
          `objects, ${scanned.names} historical path components, ${scanned.refs} ref ` +
          `${scanned.refs === 1 ? "name" : "names"}, ${scanned.tags} annotated tag ` +
          `${scanned.tags === 1 ? "message" : "messages"} and ${scanned.commits} commit ` +
          `${scanned.commits === 1 ? "message" : "messages"} (${scanned.current} blobs already read above as ` +
          `the current version, ${scanned.unread.length} not read at all and ${scanned.salvaged.length} ` +
          `read only for their runs of text, each one named above${note}${dirt})`,
      );
    }

    // Every hit consults the sentence its exemption names, tree and history alike, so the
    // sentences are read once here. It costs one file per distinct path, term and category — a
    // handful of small reads even in a pre-commit hook, and the alternative was a line number,
    // which cannot tell the occurrence somebody judged from the one that has replaced it.
    const resolved = resolve_exemption_contexts(root, exemptions, matchers, contents);
    const { reported, exempt } = partition_hits(hits, resolved.exemptions);
    // An entry whose recorded anchor no longer matches the line it names is not applied, and that
    // is an error rather than a quiet loss of coverage: it fails the run and prints the reason. An
    // entry whose file this run could not read at all is neither applied nor an error — see
    // `resolve_exemption_contexts` — so it is subtracted from the active count and named on its own.
    const failed_exemptions = [...rejected, ...resolved.mismatched];
    report({
      reported,
      exempt,
      exemptions: exemptions.length - resolved.mismatched.length - resolved.unresolved.length,
      rejected: failed_exemptions,
      scope: scopes.join(" and "),
      unread,
      partial,
      unresolved: resolved.unresolved,
      quiet: options.quiet,
      dictionaries,
    });
    return exit_code_for(reported, failed_exemptions.length);
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : String(failure));
    return 2;
  }
}

process.exit(main());
