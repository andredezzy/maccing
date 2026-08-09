#!/usr/bin/env bun

/**
 * Leak check — refuses to let a private engagement's vocabulary reach this public repository.
 *
 * The vocabulary is not here, and neither is a schema describing it. This repository ships the
 * mechanism and nothing else: a curated list of one sector's words identifies that sector
 * precisely, so the list is itself the disclosure whether or not a client is ever named — and an
 * empty template naming the *kinds* of thing worth hiding says more than it looks like it does.
 * Every dictionary arrives at run time, through `--terms <path>` or the colon-separated
 * `LEAK_TERMS` variable, and on CI that means the `LEAK_OVERLAY` secret and nowhere else. An
 * overlay carries its own exemptions too, for the same reason: an exemption has to quote the term
 * it exempts, so a public allowlist would republish a subset of the very vocabulary being withheld.
 *
 * This file lives under `.github/` beside the workflow that runs it, because it is CI apparatus
 * rather than something the published package ships.
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
 * lookalikes folded to Latin — and a phrase may cross one line break. A term is normalised the
 * same way and by the same code, or it compiles into a matcher that cannot fire against text the
 * same marks have just been taken out of, and is counted as a term loaded regardless. Paths are
 * matched as well as contents: a filename can be the whole disclosure. Every reported position
 * maps back to the characters as written.
 *
 * What this program prints is part of its threat model, because it runs as a gate in CI on a
 * public repository and those logs are world-readable. `--quiet` holds back every line that
 * carries a term, a category name or a reason, and holds back nothing else: the verdict, the
 * counts and the coverage survive it. Errors are the case no flag can cover — they reach stderr
 * before there is a report to silence — so a message about the dictionary names the fault by
 * coordinate and never quotes the text at it. The full list of print sites and the guard on each
 * is recorded above `report_dictionaries`; see `Refusal` for the error half.
 *
 * The gate matters most before a publish. A public registry blocks unpublishing after 72 hours and
 * already-resolved versions stay resolvable afterwards, so a leak that ships cannot be taken back
 * the way a git history can be rewritten and force-pushed.
 *
 * The exit code is the verdict: 1 when anything matched or any exemption was rejected, 0 when the
 * run was clean, 2 when the run could not be performed as asked.
 */

import { createHash } from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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

/**
 * What a run may say out loud about one dictionary it merged.
 *
 * There is no path here, and that is the point. An overlay's path is supplied by the operator and
 * the operator's own directory names are vocabulary — the private repository checked out into a
 * path named after itself is the documented second way to supply this file. Every count below is
 * printed on every run, `--quiet` included, so a path reaching this record reaches a
 * world-readable log. `label` is what `dictionary_labels` allows to be said instead: which of the
 * paths this run was given, and nothing about the path.
 */
type Dictionary = {
  label: string;
  terms: number;
  categories: number;
  merged: string[];
  duplicate_terms: number;
  exemptions: number;
  duplicate_exemptions: number;
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

/** A full object id, at either width git names objects with: forty hex for SHA-1, sixty-four for SHA-256. */
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** The same widths one at a time, for reading output a repository wrote in its own hash. */
const SHA1_ID = /^[0-9a-f]{40}$/;
const SHA256_ID = /^[0-9a-f]{64}$/;

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

/** The same marks, for taking every one of them out of a string at once rather than testing for one. */
const INVISIBLE_RUN = new RegExp(INVISIBLE.source, "gu");

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
 * `.github/leak-check.md` rather than hidden, and it is the right way round for a gate.
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
 * Exemptions are deduplicated on the same rule as terms, and for the same reason. They were not,
 * and the asymmetry was load-bearing: name one overlay twice — `LEAK_TERMS` exported and the same
 * path passed again to `--terms`, which the release runbook did to itself — and the run reported
 * 42 terms and said the second copy was a duplicate, while eleven exemptions became twenty-two
 * with nothing printed about the collision. No wrong verdict came of it, because suppressing the
 * same occurrence twice suppresses it once. What went was the count's meaning: `--audit`'s
 * `N active` stopped being a property of the dictionary, and one stale entry was read out twice
 * under a single verdict. Three agents filed findings against a correct criterion on the strength
 * of a doubled count in one pass of this review.
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
  // Every entry already applied at one line, because which of them a new entry collides with
  // depends on the anchors, not on the line alone. See `same_occurrence`.
  const first_entry = new Map<string, Exemption[]>();
  // The path goes no further than this function and the `quoted` key. Everything a message, a
  // header or an audit is allowed to say about a dictionary is the label; see `dictionary_labels`.
  const labels = dictionary_labels(paths);
  for (const [index, path] of paths.entries()) {
    const label = labels[index] as string;
    if (!existsSync(path)) {
      // A `Refusal`, because this file wrote the sentence and knows it names nothing. The plain
      // `Error` it used to be was converted by `main`'s fence into `withheld`, which told the
      // operator their message was suppressed because a runtime error quotes what it choked on —
      // and nothing had quoted anything, the file was simply absent. See `Refusal` and the fence.
      throw new Refusal(
        `Dictionary not found: ${label}.\n` +
          "  Nothing was read, so this run would have matched a narrower vocabulary than it was asked to. " +
          "Check the path given to --terms (or LEAK_TERMS) exists and is readable from here.",
      );
    }
    const parsed = parse_dictionary(path, label);
    const quotes = new Set<string>();
    quoted.set(path, quotes);
    const merged: string[] = [];
    let added = 0;
    let duplicate_terms = 0;
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
          duplicate_terms += 1;
          continue;
        }
        existing.terms.push(entry);
        added += 1;
      }
    }
    const parsed_exemptions = read_exemptions(label, parsed.exemptions ?? []);
    let applied = 0;
    let duplicate_exemptions = 0;
    for (const entry of parsed_exemptions.exemptions) {
      // Quoted whether or not the entry is applied: the file holds the word either way, and it is
      // the file's own text that must not be reported against itself.
      quotes.add(entry.term.toLowerCase());
      const key = exemption_identity(entry);
      const siblings = first_entry.get(key) ?? [];
      const first = siblings.find((candidate) => same_occurrence(candidate, entry));
      if (first === undefined) {
        siblings.push(entry);
        first_entry.set(key, siblings);
        exemptions.push(entry);
        applied += 1;
        continue;
      }
      if (first.why !== entry.why) {
        rejected.push(conflicting_exemption(first, entry));
        continue;
      }
      duplicate_exemptions += 1;
    }
    rejected.push(...parsed_exemptions.rejected);
    dictionaries.push({
      label,
      terms: added,
      categories: parsed.categories.length,
      merged,
      duplicate_terms,
      exemptions: applied,
      duplicate_exemptions,
    });
  }
  return { categories, exemptions, rejected, dictionaries, quoted };
}

/**
 * The line an entry was written against, which is as far as two entries can be told apart without
 * reading the file: path, category, term and line.
 *
 * They are the fields `partition_hits` and `covers` look entries up by. `partition_hits` folds the
 * term's case the way the matcher lookup folds it, so two spellings differing only in case are
 * already one entry to everything downstream; `covers` then consults `line` — 0 names the path,
 * anything else names content. Drop `line` and every entry for a path, category and term becomes
 * one entry, which is precisely the key `covers` was moved off because it spent one person's
 * judgement on text they never read.
 *
 * What this deliberately leaves out is `anchor`, because the anchor does not split a line into
 * disjoint entries — see `same_occurrence`. `why` and `source` are left out too: neither changes
 * what is suppressed, so neither can make two entries into two suppressions, but a `why` that
 * differs is a real disagreement rather than a copy and `conflicting_exemption` handles that.
 */
function exemption_identity(entry: Exemption): string {
  return `${exemption_key(entry.path, entry.category, entry.term)}\u0000${entry.line}`;
}

/**
 * Whether two entries already agreeing on `exemption_identity` suppress the same occurrence — the
 * question that decides whether the second is a copy, a disagreement, or a second entry.
 *
 * Comparing the raw `anchor` field answered it wrongly, because an empty anchor is not a value
 * alongside the digests: it means *every* clause at this line. `covered_contexts` resolves an
 * unanchored entry to all of them and an anchored one to the single clause its digest names, so an
 * unanchored entry covers everything any anchored entry at that line covers. Where a line carries
 * one clause the two resolve to exactly the same context and suppress exactly the same hit, and
 * with the raw field in the key they were two identities: a duplicate was never counted as one,
 * and two contradictory reasons over that one occurrence were never refused.
 *
 * So the anchor is compared as what it resolves to. An empty one subsumes any anchor at its line;
 * two digests are the same occurrence only when they are the same digest. That holds however many
 * clauses the line has, and needs no file read: on a line with several clauses the unanchored
 * entry still covers the anchored one's clause, so the two still speak about one occurrence and
 * still may not disagree about it silently. Two *different* digests remain two entries, which is
 * the case `covered_contexts` exists to keep apart.
 */
function same_occurrence(first: Exemption, second: Exemption): boolean {
  return first.anchor === "" || second.anchor === "" || first.anchor === second.anchor;
}

/**
 * Two entries covering the same occurrence for different stated reasons. One of them is wrong, or
 * describes text that has since been rewritten, and nothing here can tell which — so the run
 * refuses rather than picking. Collapsing them silently would leave the second author believing a
 * reason is in force that nobody will ever print, and keeping both would read the same occurrence
 * out twice under one verdict, which is the doubling this dedupe exists to stop.
 *
 * The first entry stands, so no coverage is lost while the disagreement is settled; the second is
 * not applied and the run fails, because an exemption error is how this file says a suppression
 * needs a person.
 */
function conflicting_exemption(first: Exemption, second: Exemption): string {
  return (
    `${second.source} (${second.path}:${second.line} — ${second.term}): the same occurrence is ` +
    `already exempted for a different reason by ${first.source}. First: "${first.why}". ` +
    `This one: "${second.why}". Two reasons for one occurrence is not a duplicate — one of them describes ` +
    "text that has changed, and this run cannot tell which. The first entry stands and this one is not " +
    "applied; correct or remove one of them."
  );
}

/**
 * An error this file wrote, whose message is known to name the dictionary rather than quote it.
 *
 * The distinction is the whole of it. `main` prints a failure to stderr and returns 2, and stderr
 * is the one stream `--quiet` was never able to reach — nor should it, because an operator whose
 * overlay is broken has to be told so. That makes every message on this path a message published
 * to whatever log the gate runs in, and on a public repository that log is world-readable. A
 * message written here is safe there by construction. A message out of the runtime is not: a JSON
 * parse error quotes the token it choked on, and the token is a fragment of the secret.
 */
class Refusal extends Error {}

/** Why every message about a dictionary carries a coordinate and never the text at it. */
const WITHHELD =
  "The text there is withheld: this goes to stderr, which --quiet does not reach and must not, so it " +
  "has to be safe on a world-readable log.";

/**
 * A fault in a dictionary, named by where it is rather than by what it says.
 *
 * Everything a reader needs to find the entry, and nothing that reproduces it: which dictionary,
 * the category's position in it, the entry's position in the category, the field that is wrong,
 * and the command that prints the entry where the overlay already lives. The hit lines have
 * worked this way for as long as `--quiet` has existed; these did not, and no flag could have
 * saved them.
 *
 * `label` and not the path. The path is the operator's, and an operator who followed the
 * workflow's second option is holding the private repository's own name — see
 * `dictionary_labels`. The `jq` is still exact and the operator supplies the filename, which they
 * have and this log must not.
 */
function dictionary_fault(label: string, category: number, term: number | null, wrong: string): Refusal {
  const at = term === null ? `category ${category + 1}` : `category ${category + 1}, term ${term + 1}`;
  const pointer = term === null ? `.categories[${category}]` : `.categories[${category}].terms[${term}]`;
  return new Refusal(
    `Dictionary ${at} ${wrong}.\n` +
      `  In ${label}. ${WITHHELD}\n` +
      `  Read the entry where the overlay lives: jq '${pointer}' <that file>`,
  );
}

/**
 * An error out of the runtime, reduced to the fact that there was one.
 *
 * Anything thrown while the dictionary is being read has the dictionary in reach, and a runtime
 * error's message quotes whatever it choked on. Only messages this file wrote cross to stderr; the
 * rest are named by their type and the files that were being merged, which is enough to reproduce
 * the run locally and nothing that repeats what it was reading.
 */
function withheld(failure: unknown, labels: string[]): Refusal {
  return new Refusal(
    `Loading the dictionaries failed with an error this file did not write ` +
      `(${failure instanceof Error ? failure.name : typeof failure}), so its message is withheld: a runtime ` +
      "error quotes whatever it choked on, and here that is the dictionary. Merged in order: " +
      `${labels.join(", ")}. Re-run locally, where the overlay lives, to read it.`,
  );
}

/** What a JSON text was found to be wrong with, in this file's words rather than the engine's. */
type JsonFault = { offset: number; note: string };

const JSON_SPACE: Record<string, true> = { " ": true, "\t": true, "\n": true, "\r": true };
/** The escapes JSON defines, `\u` excepted: it takes four hex digits and is checked on its own. */
const JSON_ESCAPE: Record<string, true> = {
  '"': true,
  "\\": true,
  "/": true,
  b: true,
  f: true,
  n: true,
  r: true,
  t: true,
};
/** Sticky, so a number is read at an offset without slicing the rest of the file to get there. */
const JSON_NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
/** Deeper than any dictionary and shallower than this recursion can safely go. */
const JSON_DEPTH_LIMIT = 512;

/**
 * Where a JSON text first stops being JSON.
 *
 * `JSON.parse` already knows, and will not say: JavaScriptCore's `SyntaxError` carries the line
 * and column of the `JSON.parse` call rather than of the text, and the only thing its message
 * locates the fault by is a quotation of it — `Unexpected identifier "<token>"`. That token is a
 * fragment of the dictionary. So the position is found here, and the engine's message is never
 * forwarded at all, which also means a future engine cannot reopen this by rewording it.
 *
 * A validator rather than a parser: it walks the grammar and builds no value. It is only ever
 * asked about a text `JSON.parse` has already rejected, and when the two disagree — it returns
 * `null` for a text the engine refused — the caller says so rather than inventing a position.
 */
function json_fault(text: string): JsonFault | null {
  let at = 0;
  const fault = (note: string): JsonFault => ({ offset: at, note });
  const space = (): void => {
    while (at < text.length && JSON_SPACE[text.charAt(at)] === true) {
      at += 1;
    }
  };
  const string = (): JsonFault | null => {
    const opened = at;
    at += 1;
    while (at < text.length) {
      const character = text.charAt(at);
      if (character === '"') {
        at += 1;
        return null;
      }
      if (character === "\\") {
        if (text.charAt(at + 1) === "u") {
          for (let digit = 2; digit < 6; digit += 1) {
            if (hex_value(text.charAt(at + digit)) < 0) {
              return fault("a `\\u` escape without four hexadecimal digits after it");
            }
          }
          at += 6;
          continue;
        }
        if (JSON_ESCAPE[text.charAt(at + 1)] !== true) {
          return fault("a backslash that begins no escape JSON defines");
        }
        at += 2;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) {
        return fault("a control character inside a string, which JSON requires written as an escape");
      }
      at += 1;
    }
    // The position that helps is where the string opened, not where the file ran out.
    at = opened;
    return fault("a string that is never closed");
  };
  const object = (depth: number): JsonFault | null => {
    at += 1;
    space();
    if (text.charAt(at) === "}") {
      at += 1;
      return null;
    }
    for (;;) {
      space();
      if (at >= text.length) {
        return fault("the end of the file inside an object");
      }
      if (text.charAt(at) !== '"') {
        return fault("an object member whose name is not a quoted string");
      }
      const name = string();
      if (name !== null) {
        return name;
      }
      space();
      if (text.charAt(at) !== ":") {
        return fault("an object member with no `:` between its name and its value");
      }
      at += 1;
      const held = value(depth + 1);
      if (held !== null) {
        return held;
      }
      space();
      if (text.charAt(at) === ",") {
        at += 1;
        continue;
      }
      if (text.charAt(at) === "}") {
        at += 1;
        return null;
      }
      return fault(
        at >= text.length ? "the end of the file inside an object" : "an object member followed by neither `,` nor `}`",
      );
    }
  };
  const array = (depth: number): JsonFault | null => {
    at += 1;
    space();
    if (text.charAt(at) === "]") {
      at += 1;
      return null;
    }
    for (;;) {
      const held = value(depth + 1);
      if (held !== null) {
        return held;
      }
      space();
      if (text.charAt(at) === ",") {
        at += 1;
        continue;
      }
      if (text.charAt(at) === "]") {
        at += 1;
        return null;
      }
      return fault(
        at >= text.length ? "the end of the file inside an array" : "an array element followed by neither `,` nor `]`",
      );
    }
  };
  const value = (depth: number): JsonFault | null => {
    if (depth > JSON_DEPTH_LIMIT) {
      return fault(`more than ${JSON_DEPTH_LIMIT} levels of nesting`);
    }
    space();
    if (at >= text.length) {
      return fault("the end of the file where a value was expected");
    }
    const character = text.charAt(at);
    if (character === '"') {
      return string();
    }
    if (character === "{") {
      return object(depth);
    }
    if (character === "[") {
      return array(depth);
    }
    for (const word of ["true", "false", "null"]) {
      if (text.startsWith(word, at)) {
        at += word.length;
        return null;
      }
    }
    JSON_NUMBER.lastIndex = at;
    const digits = JSON_NUMBER.exec(text);
    if (digits === null) {
      return fault(
        "something that begins no JSON value: not a string, number, object, array, `true`, `false` or `null`",
      );
    }
    at += digits[0].length;
    return null;
  };

  const document = value(0);
  if (document !== null) {
    return document;
  }
  space();
  return at < text.length ? fault("more text after the value the file begins with") : null;
}

/** A text `JSON.parse` refused, turned into a refusal that names where and not what. */
function json_refusal(label: string, text: string): Refusal {
  const fault = json_fault(text);
  const starts = line_starts(text);
  if (fault === null) {
    return new Refusal(
      `Dictionary is not valid JSON: ${label}\n` +
        "  `JSON.parse` refused it and the scan for the fault found none, so the two disagree. The file is " +
        `${text.length} characters over ${starts.length} lines. ${WITHHELD}\n` +
        "  Read it where the overlay lives: jq . <that file>",
    );
  }
  const line = line_of(starts, fault.offset);
  return new Refusal(
    `Dictionary is not valid JSON: ${label}\n` +
      `  The first fault is at line ${line + 1}, column ${fault.offset - (starts[line] ?? 0) + 1}: ${fault.note}. ` +
      `${WITHHELD}\n` +
      `  Read it where the overlay lives: sed -n '${line + 1}p' <that file>`,
  );
}

/**
 * A dictionary that does not parse is louder than a dictionary that is missing, because a caller
 * who passed `--terms` believes a dictionary was loaded. Every check below names which dictionary
 * and the coordinate of the entry that is wrong, so a malformed overlay is a two-second fix
 * rather than a hunt — and names nothing else, because these messages go to stderr and stderr is
 * published. See `Refusal`.
 *
 * `path` opens the file and `label` is the only part of it that may be said out loud; see
 * `dictionary_labels` for why the two are not the same string.
 */
function parse_dictionary(path: string, label: string): TermFile {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (failure) {
    // Reading and parsing were one `try`, so a permission or device failure was reported as a
    // syntax error and sent somebody hunting for a missing brace in a file they could not open.
    throw new Refusal(
      `Dictionary could not be read: ${label}\n` +
        `  The open failed (${failure instanceof Error && "code" in failure ? String(failure.code) : "no code given"}). ` +
        "That is a permission or a device problem, not a syntax one, and no edit to the JSON will fix it.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw json_refusal(label, text);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Refusal(
      `Dictionary is not a JSON object: ${label}\n` +
        "  A dictionary is an object with a `categories` array. Anything else would load as an empty " +
        "dictionary and pass a gate that checked nothing.",
    );
  }
  const file = parsed as { categories?: unknown; exemptions?: unknown };
  if (file.categories !== undefined && !Array.isArray(file.categories)) {
    throw new Refusal(`Dictionary \`categories\` is not an array: ${label}`);
  }
  if (file.exemptions !== undefined && !Array.isArray(file.exemptions)) {
    throw new Refusal(`Dictionary \`exemptions\` is not an array: ${label}`);
  }
  const categories: TermCategory[] = [];
  for (const [index, raw] of ((file.categories ?? []) as unknown[]).entries()) {
    const candidate = raw as Partial<TermCategory>;
    if (typeof candidate?.name !== "string" || candidate.name.trim() === "") {
      throw dictionary_fault(label, index, null, "has no `name`");
    }
    if (!Array.isArray(candidate.terms)) {
      throw dictionary_fault(label, index, null, "has no `terms` array");
    }
    const terms: TermEntry[] = [];
    for (const [position, entry] of candidate.terms.entries()) {
      const term = typeof entry?.term === "string" ? entry.term.trim() : "";
      if (term === "") {
        throw dictionary_fault(label, index, position, "has no `term`");
      }
      // A term that survives normalisation with nothing left compiles into a matcher that can
      // never fire, and is counted as a term loaded all the same — which is the number the header,
      // the verdict line and `--require-overlay` all read. A dictionary of them reports PASSED
      // while protecting nothing, so this is refused here rather than counted there.
      if (term_body(term, false) === null) {
        throw dictionary_fault(
          label,
          index,
          position,
          "is written entirely in characters that carry no glyph of their own — a zero-width space, a soft " +
            "hyphen, a directional mark — so it normalises away to nothing and could never match anything. " +
            "It would still count as a term loaded, which is what --require-overlay tests, so the gate would " +
            "report PASSED while protecting nothing",
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
 *
 * `source` is the dictionary's label, never its path: it is copied onto every entry and read back
 * out on the audit's own header, which is printed on every run. See `dictionary_labels`.
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
    const label = `${source} entry ${index + 1}${named}`;
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

/**
 * The pattern body for a term: each word case-insensitive, the words joined by the phrase rule.
 *
 * A word that is nothing but invisible marks folds away to nothing and is dropped rather than
 * emitted as an empty alternative, because an empty body matches at every position — one
 * malformed entry would report a hit on every line of the repository. A term that is nothing but
 * such words returns `null`, and `parse_dictionary` refuses it.
 */
function term_body(term: string, capitalised: boolean): string | null {
  const folded = term
    .trim()
    .split(/\s+/)
    .map((word) => fold(word))
    .filter((word) => word.length > 0);
  if (folded.length === 0) {
    return null;
  }
  const words = folded.map((word) => literal_characters(word));
  if (capitalised) {
    const first = words[0] as string[];
    // The first character of the first surviving word, not of the term as written: a term opening
    // on a mark with no glyph has already lost it, and the letter after it is the one to capitalise.
    const head = [...(folded[0] as string)][0] ?? "";
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
        // Unreachable for a dictionary that came through `parse_dictionary`, which refuses a term
        // that normalises away with a coordinate into the file it came from. A skip here instead
        // was how a term nothing could match still counted as a term loaded, so what is left is a
        // refusal rather than a `continue`: no path may drop a term without saying so.
        throw new Refusal(
          "A term of the merged vocabulary normalises away to nothing, so it would compile into a matcher " +
            "that can never fire. Every dictionary read from a file is checked for this as it is parsed, so " +
            "reaching here means a category was built somewhere else and never checked.",
        );
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
 * The marks with no glyph go first. `compose` already drops them from a scanned text before it
 * folds, and for a long time nothing dropped them from a *term* — so a term carrying a zero-width
 * space or a soft hyphen compiled into a matcher that could never fire against text the same
 * marks had just been taken out of, and counted as a term loaded all the same. Both sides of the
 * comparison normalise here now, which is the only way the two can be guaranteed to agree.
 *
 * NFKC rather than NFC, because NFC leaves every compatibility form alone: a fullwidth `ａ`, a
 * mathematical `𝖺` and the `ﬁ` ligature all read as ordinary letters and all walk past an NFC
 * match, including one fullwidth letter dropped into an otherwise plain word. Then the confusable
 * table above folds the Cyrillic and Greek Latin-lookalikes, which no normalisation form touches
 * because they are genuinely different letters.
 */
function fold(text: string): string {
  // `compose` has already stripped the clusters it hands over, so on the hot path the test fails
  // and nothing is rewritten; the terms, which are folded once at load time, are what this is for.
  const visible = INVISIBLE.test(text) ? text.replace(INVISIBLE_RUN, "") : text;
  const composed = visible.normalize("NFKC");
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
  // One spelling for the whole loop, and the same one on both sides of it. `root` reaches here
  // from git in one mode and from the resolved `--path` in another; the paths beside it are built
  // by joining or walking whichever of those it was. Canonicalising the root alone would break the
  // pairing rather than fix it — the leaves have to be resolved the same way, and as leaves, so a
  // symlink keeps its own name and is reported under it. The root is resolved once, outside the
  // loop, because it is the same directory every time round.
  const base = canonical_root(root);
  for (const path of paths) {
    const absolute = canonical(path);
    if (absolute.split(sep).includes(".git")) {
      excluded += 1;
      continue;
    }
    const here = under(base, absolute);
    const label = here === null ? absolute : here.split(sep).join("/");
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
      } catch (failure) {
        // Absent and unreachable are different facts. `ENOENT` is the path being gone; `EACCES`
        // is a directory on the way to it refusing this user, and the file is still there. One
        // sentence covered both, so a file behind a locked directory was reported as deleted
        // without being staged, left out of a sparse checkout, or carrying a skip-worktree bit —
        // three claims that are all false at once, and each of them sends somebody looking
        // through git for a change nobody made.
        const code = (failure as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR" && code !== "EACCES" && code !== "EPERM") {
          throw failure;
        }
        unreadable.push(
          code === "EACCES" || code === "EPERM"
            ? `${label} — a directory on the way to it refuses this user, so the file could not be reached ` +
                "and nothing in it was read"
            : `${label} — listed for this scan and not on disk: deleted without being staged, left out of a ` +
                "sparse checkout, or carrying a skip-worktree bit",
        );
        continue;
      }
      if (stats.isSymbolicLink()) {
        // `lstat` answering does not mean `readlink` will — a link's own mode can refuse it, and
        // on a tracked scan that escaped as an exception and took the whole run with it: exit 2,
        // no verdict, and nothing said about the files that were read. It is the same kind of gap
        // as a file whose mode refuses the read, and the report already has a place to name it.
        try {
          text = readlinkSync(absolute);
        } catch (failure) {
          const code = (failure as NodeJS.ErrnoException).code;
          if (code !== "EACCES" && code !== "EPERM") {
            throw failure;
          }
          unreadable.push(`${label} — a symlink whose own mode refuses the read of the target it stores`);
          continue;
        }
        // What the repository stores for a symlink is the target string, so the target string is
        // the content and its digest is the name the object graph knows that content by.
        receipt(new TextEncoder().encode(text));
      } else if (!stats.isFile()) {
        unreadable.push(`${label} — not a readable file: a submodule's directory, a stale index entry, or a device`);
        continue;
      } else {
        // `lstat` answering does not mean `open` will. A mode this user cannot read escaped here
        // as an exception and took the whole run with it — exit 2, the absolute path on stderr,
        // and no verdict at all about the files that were read. It is the same kind of gap as a
        // path that is absent, and the report already has a place to name it.
        let bytes: Buffer;
        try {
          bytes = readFileSync(absolute);
        } catch (failure) {
          const code = (failure as NodeJS.ErrnoException).code;
          if (code !== "EACCES" && code !== "EPERM") {
            throw failure;
          }
          unreadable.push(`${label} — not readable by this user: the file is there and its mode refuses the read`);
          continue;
        }
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
  // Git answers with the directory the kernel resolved, and every caller compares this against a
  // path that came from somewhere else. Saying so here rather than assuming it is what makes the
  // comparisons downstream sound; see `canonical`.
  return canonical_root(found.stdout.trim());
}

/**
 * The repository a scope-less run is about.
 *
 * The script's own directory answers first, and that is deliberate: it is what makes a copy
 * invoked from inside a clone scan the clone rather than wherever the caller happened to be
 * standing, which is the hazard the `--path` section of the README describes.
 *
 * That question has no answer when the script does not live in a repository at all — which is how
 * it runs from a scratch directory, deliberately kept out of every checkout so that gating a
 * repository never means committing the gate to it. Every mode but `--self-test` and `--path`
 * then died on `Not inside a git repository` before reading a byte. The working directory is the
 * only other thing that can be meant, so it is asked second, and a run from outside any
 * repository still fails — on the caller's own directory, which is the one they can act on.
 */
function gated_root(): string {
  const found = git_text(["rev-parse", "--show-toplevel"], import.meta.dir);
  return found.ok ? canonical_root(found.stdout.trim()) : repo_root(process.cwd());
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
 * The commit messages out of `git log --format=%B%n%H`, which terminates each one with the
 * commit's own object id on a line of its own.
 *
 * That id is as wide as the repository names its objects, and a checker that only knows the
 * narrow one finds no terminator at all in a SHA-256 repository: no commit is recorded, no
 * message is ever scanned, and the run prints PASSED over the whole history. Measured — a
 * SHA-256 repository holding a term in a commit message reported `0 commit messages` and passed,
 * while the SHA-1 control found it.
 *
 * The width asked for is the repository's own rather than either width, so a message line that
 * happens to be an object id at the *other* width stays body text. A line at the repository's own
 * width is still read as the terminator and splits one commit in two; the hits are still
 * reported, and only the id printed beside them is wrong. When git cannot say which hash names
 * this repository's objects, either width is accepted, because reading the messages under a
 * guessed id beats not reading them at all.
 */
function parse_commit_messages(log: string, format: string | null): Array<{ sha: string; message: string }> {
  const terminator = format === "sha256" ? SHA256_ID : format === "sha1" ? SHA1_ID : OBJECT_ID;
  const commits: Array<{ sha: string; message: string }> = [];
  let buffer: string[] = [];
  for (const line of log.split("\n")) {
    if (terminator.test(line)) {
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
 * The object each `<commit>:<path>` names, in the order asked, so a commit's tree can be compared
 * against its parents' without one process per lookup. `--batch-check` prints one line per
 * request and prints the *resolved* id rather than the request, so the answers are matched by
 * position exactly as `read_objects` matches its own; a request git could not resolve answers
 * `<request> missing` and still occupies its line.
 *
 * An answer is only read as an id when it is exactly `<id> <type> <size>`. A path with a space in
 * it makes `<request> missing` three fields as well, and the first of them is the head of the
 * request rather than any object — a shape that would resolve to a string no comparison here can
 * ever match, but by accident rather than because it was rejected.
 */
function resolve_specs(root: string, specs: string[]): Array<string | null> {
  const resolved: Array<string | null> = [];
  for (let start = 0; start < specs.length; start += 4096) {
    const chunk = specs.slice(start, start + 4096);
    const run = run_git(["cat-file", "--batch-check"], root, new TextEncoder().encode(`${chunk.join("\n")}\n`));
    const lines = run.stdout.toString("utf8").split("\n");
    for (let index = 0; index < chunk.length; index += 1) {
      const fields = (lines[index] ?? "").split(" ");
      const id = fields[0] ?? "";
      resolved.push(fields.length === 3 && OBJECT_ID.test(id) ? id : null);
    }
  }
  return resolved;
}

/**
 * Where a blob entered the walk, and how much of that the walk can prove. A rewrite is planned off
 * these commits, so the four kinds are four different claims and the label prints the one earned:
 *
 * - `added` — every commit whose tree holds the blob at this path where no parent's tree does.
 *   These are the commits a cut has to be made at, and this is the only kind that says so.
 * - `held` — no candidate adds it here, so this is the oldest one whose tree does hold it: the
 *   blob was carried into the range from outside it, or the same bytes are also filed under a
 *   name the walk resolved against a different path.
 * - `touched` — the object has no path in this walk, so there is no tree entry to compare. This
 *   is the oldest commit whose diff mentions it, and nothing further is known.
 * - `none` — nothing the walk listed holds it, and `commits` is empty.
 */
type Attribution = { commits: string[]; kind: "added" | "held" | "touched" | "none" };

/** The clause each kind earns, beside a hit, for somebody deciding where to cut. */
const ORIGIN_CLAUSE: Record<Attribution["kind"], (named: string) => string> = {
  added: (named) => `added in ${named}`,
  held: (named) => `first held in ${named}, which inherited it`,
  touched: (named) => `first touched in ${named}`,
  none: () => "no commit in the scanned range adds it",
};

/**
 * The commits that put this blob at this path, oldest first — the commits a rewrite has to cut at.
 *
 * `--find-object` reports every commit whose diff *touches* the object, which is the commit that
 * added it and the commit that replaced or deleted it alike. Asking git for one of them and taking
 * the first answer took the newest: the commit holding the *next* version of the path, which is
 * the one commit in the list whose tree is guaranteed not to contain the blob. Measured on a clone
 * of the recovery bundle detached at `9a0162d4`, on
 * `skills/growth/growth/references/outsourced-dispatch.md`: `4cc66fa`, added by `a37cc43`, was
 * labelled `d88c3b22`; `a90bcbe`, added by `d88c3b22`, was labelled `46c63d1`; and the version in
 * the checked-out tree, `96f0d82`, added by `46c63d1`, was labelled `9368a954`.
 *
 * So the candidates are filtered rather than trusted. A commit introduces the blob at the path
 * when its own tree holds it there and no parent's tree does; a root commit has no parents and
 * qualifies on its own tree alone. That is exact, and it is the question a cleanup asks.
 *
 * `-c` is what puts merges in front of that filter. `git log` does not diff a merge at all unless
 * it is asked to, so a merge whose resolved content differs from every parent — which is what
 * every hand-edited conflict resolution is — was never a candidate, and the only commit git did
 * return was the later one whose diff takes the blob away again. Measured on a two-branch conflict
 * resolved by hand: the resolution `30dc252f` is the one commit whose tree holds the secret, and
 * the label read `added in 58914faeec09`, the commit that replaced it. Of the four spellings that
 * make merges candidates, `-c` is the one whose question is this one: it diffs the merge against
 * all of its parents at once, lists each merge once however many parents it has, and has no
 * pruning pass between selecting an object and reporting it. `-m` lists a merge once per parent,
 * so an octopus resolution would be named three times over. `--diff-merges=first-parent` asks a
 * narrower question than the filter below answers. `--cc` is `-c` plus a hunk-pruning pass that
 * exists to drop output, which is one pass too many to stand between a secret and its commit.
 * `--no-patch` follows because `-c` implies `-p`, and it is cost rather than a guard: the combined
 * diff of every merge in the walk is generated and printed for every blob queried, and nothing
 * here reads a line of it. Measured on this repository's own README, one blob: 328 bytes with it,
 * 2175 without. It is not a correctness guard, and no test below pretends otherwise. A bare
 * context line the parse would take for a candidate can only be a line of the blob itself —
 * `--find-object` shows the diff of the object's own path and no other — so for that candidate to
 * be named it would have to be the id of a commit whose tree holds the blob that spells it out,
 * which is a preimage rather than a bug.
 *
 * The walk's own range is the range asked here, and that is the second half of the third case
 * above. `9368a954` moved the file elsewhere and is a *descendant* of the scanned tip, so asking
 * `--all` reached past everything the run was given and named a commit that holds neither that
 * path nor any part of the range — a label pointing outside the thing being cleared. A run that
 * scanned a range answers out of that range or says it cannot.
 *
 * Every answer is reported, not the first. One blob can be introduced more than once — added,
 * deleted and added back, or committed independently on two branches — and each of those is a
 * separate point the history has to be cut at. Naming one of them silently would send somebody to
 * cut at one and stop.
 *
 * What is left when no candidate adds it is not an addition and is not labelled as one. A
 * candidate whose tree does not hold the blob at this path is a removal, and naming it sends an
 * operator to cut at a commit the secret was never in — the walk has already resolved that tree
 * and may not throw the answer away. So the fallback is the oldest candidate whose tree does hold
 * it: the blob was carried in from outside the range, or the same bytes are also filed under a
 * name this walk resolved against a different path, and either way that commit has it. With no
 * path there is no tree entry to compare at all, so the oldest candidate is reported as touched
 * rather than as added. When nothing listed holds it, the walk says nothing.
 */
function introducing_commits(root: string, range: string | null, oid: string, path: string): Attribution {
  const touched = git_text(
    ["log", "--format=%H %P", "-c", "--no-patch", `--find-object=${oid}`, range ?? "--all"],
    root,
  );
  if (!touched.ok) {
    return { commits: [], kind: "none" };
  }
  const candidates: Array<{ sha: string; parents: string[] }> = [];
  for (const line of touched.stdout.split("\n")) {
    const fields = line.trim().split(" ");
    const sha = fields[0];
    if (sha === undefined || !OBJECT_ID.test(sha)) {
      continue;
    }
    // Everything after the id is `%P`, which is ids and nothing else. The line already had to
    // begin with one to be read at all, and git writes a blank line between records, which is the
    // shape the test above is here to drop.
    candidates.push({ sha, parents: fields.slice(1) });
  }
  const oldest = candidates[candidates.length - 1]?.sha;
  if (oldest === undefined) {
    return { commits: [], kind: "none" };
  }
  if (path === "") {
    return { commits: [oldest], kind: "touched" };
  }
  // One request for the commit's own entry at the path, then one for each parent's, in that order,
  // so the answers can be read back off the same walk that wrote them.
  const specs: string[] = [];
  for (const candidate of candidates) {
    specs.push(`${candidate.sha}:${path}`);
    for (const parent of candidate.parents) {
      specs.push(`${parent}:${path}`);
    }
  }
  const resolved = resolve_specs(root, specs);
  const introduced: string[] = [];
  // Newest first, as git listed them, so the last of these is the oldest.
  const holding: string[] = [];
  let at = 0;
  for (const candidate of candidates) {
    const here = resolved[at];
    const parents = resolved.slice(at + 1, at + 1 + candidate.parents.length);
    at += 1 + candidate.parents.length;
    if (here !== oid) {
      continue;
    }
    holding.push(candidate.sha);
    if (!parents.includes(oid)) {
      introduced.push(candidate.sha);
    }
  }
  if (introduced.length > 0) {
    return { commits: introduced.reverse(), kind: "added" };
  }
  const carried = holding[holding.length - 1];
  return carried === undefined ? { commits: [], kind: "none" } : { commits: [carried], kind: "held" };
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
 * label naming the commit that added it. Refusing to clear a dirty tree instead is simpler and
 * unambiguous, and it makes the clearance unusable during exactly the hours a repository is dirty
 * — mid-work, which is when somebody types a client's name — so it would be run less, and a gate
 * that is skipped clears nothing. Nothing is left unscanned, so no run has to invent a verdict for
 * a clearance that stopped halfway.
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
      // What the commit clause means is written into it. `commit X` beside a hit reads as "X
      // introduced this" to anybody about to rewrite a history, so the label says `added in` only
      // where the walk proved it, and where a blob was added at more than one point it names
      // every one of them rather than picking a home and keeping quiet about the others. The
      // other clauses claim less, in words, rather than claiming this one on weaker evidence.
      const introduced = introducing_commits(root, range, oid, path);
      const origin = ORIGIN_CLAUSE[introduced.kind](introduced.commits.map((sha) => sha.slice(0, 12)).join(", "));
      // The commit clause is a clause of its own and the path travels on the hit, because a path
      // may contain an `@`. Recovering the path by cutting the label at its last `@` read
      // `node_modules/@scope/name` as `node_modules/`, so an exemption written for one path could
      // suppress a hit belonging to another. Nothing parses a label now, and the shape here is the
      // one `name_of` above already uses, so a reader can see where the path ends.
      const label = `history:${path === "" ? "(no path)" : path} (${origin})`;
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
  // The terminator git writes is an id in this repository's own hash, so the parse is told which.
  const commits = parse_commit_messages(logged.stdout, object_format(root));
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
        `${entry.source} (${entry.path}:${entry.line} — ${entry.term}): this run could not read ` +
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
        `${entry.source} (${entry.path}:${entry.line} — ${entry.term}): the sentence recorded as ` +
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

/**
 * One spelling of a path, so that two of them can be compared.
 *
 * `resolve` is lexical: it makes a path absolute and leaves every symlink in it standing. Git is
 * not — `rev-parse --show-toplevel` answers with the directory the kernel resolved, symlinks and
 * all. On a machine where `/tmp` is a symlink to `/private/tmp`, one side of a comparison holds
 * `/tmp/x/leak-terms.json` and the other `/private/tmp/x`, `relative` between them opens with
 * `..`, and every test of the shape "is this inside that" answers no. That is how the refusal
 * that keeps an overlay out of the tree being scanned was defeated by a spelling: the run
 * proceeded, the overlay sat in the scan with its own terms muted inside it, and the gate printed
 * PASSED over the one file holding the vocabulary.
 *
 * The last component is deliberately left alone. A symlink handed to `--path`, or listed by the
 * walk, is content in its own right — what the repository stores for it is the target string — so
 * resolving it would read something else under its name. Everything above it is resolved, which
 * is where the disagreement lives. A path whose parents do not exist yet falls back to the
 * deepest ancestor that does, so this answers for a file that is about to be written and for one
 * that is simply missing.
 */
function canonical(target: string): string {
  const absolute = resolve(target);
  const tail = [basename(absolute)];
  let head = dirname(absolute);
  for (;;) {
    try {
      return join(realpathSync(head), ...tail);
    } catch {
      const up = dirname(head);
      if (up === head) {
        return absolute;
      }
      tail.unshift(basename(head));
      head = up;
    }
  }
}

/**
 * A directory resolved the whole way, its own last component included.
 *
 * A root is a place, not a name. Two runs pointed at one directory — one through a symlink to it,
 * one at the directory itself — have to agree about what is inside it, so the thing a containment
 * test measures *against* resolves completely. Contrast `canonical`, which keeps a symlink's own
 * name because a symlink is content the scanner reads and reports under that name.
 *
 * A directory that is not there yet falls back to `canonical`, which resolves as much of it as
 * exists. Nothing is inside a directory that does not exist, so the answer is the same either way
 * and this only keeps the spelling stable.
 */
function canonical_root(target: string): string {
  try {
    return realpathSync(resolve(target));
  } catch {
    return canonical(target);
  }
}

/**
 * Where `path` sits under `root`, or `null` when it does not sit under it at all.
 *
 * Purely lexical, and every caller has to hand it two spellings that can be compared — see
 * `canonical`, and see each call site for where its two came from.
 *
 * `..` is tested as a whole component. `startsWith("..")` also rejects `..notes`, which is a
 * perfectly ordinary file at the root and was being reported as living outside it.
 */
function under(root: string, path: string): string | null {
  const here = relative(root, path);
  if (here === "" || isAbsolute(here) || here === ".." || here.startsWith(`..${sep}`)) {
    return null;
  }
  return here;
}

/** Where this process is, resolved once, as the first thing `shorten` measures against. */
const HERE = canonical_root(process.cwd());

/** The account's own directory, as the second. */
const HOME = canonical_root(homedir());

/**
 * A path said as briefly as it can be said without naming something else.
 *
 * Relative to the working directory when it sits under it. When it does not — which is every run
 * started from anywhere but the repository, and that includes a git hook, a CI step and a scan of
 * a clone in `/tmp` — the fallback used to be the absolute path, so the operator's home directory
 * went into the header beside the built-in dictionary, into every unresolved-exemption line, and
 * onto a public repository's build log. `~` says the same thing about a place without naming the
 * account it belongs to, and the absolute spelling is kept only for a path that is under neither.
 */
function shorten(path: string): string {
  const absolute = canonical(path);
  const home = under(HOME, absolute);
  return under(HERE, absolute) ?? (home === null ? absolute : `~/${home}`);
}

/**
 * What may be said about each dictionary this run merged, in the order it merged them.
 *
 * An overlay's path is not a diagnostic, it is content. The workflow's second documented way to
 * supply one is to check the private repository out and point `--terms` at it, and the private
 * repository's own name is a term the dictionary declares — so printing the path as supplied put
 * a declared term on a world-readable log on every run of every step, `--quiet` included, because
 * the line it sat on is a count and counts are never silenced. A basename does not help; the file
 * is as likely to be named after the engagement as the directory is. A digest of the path does
 * not either: it is a confirmation oracle for anyone who can guess the path, and in CI the
 * surrounding path is a published template.
 *
 * What the header actually needs is to tell one dictionary's counts from another's, and which of
 * the paths the operator typed each one came from. An ordinal says both and carries nothing.
 *
 * There is no dictionary shipped beside this file to name. This repository holds the mechanism and
 * nothing else — no terms, no categories, not even the empty schema that used to sit here, because
 * a schema documenting which kinds of thing are worth hiding is itself a description of the work
 * being hidden. Every dictionary this run sees arrived through `--terms` or `LEAK_TERMS`, which on
 * CI means the secret and nowhere else.
 */
function dictionary_labels(paths: string[]): string[] {
  return paths.map((_, at) =>
    paths.length === 1 ? "the overlay given to --terms" : `overlay ${at + 1} of ${paths.length} given to --terms`,
  );
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
  const opening =
    dictionaries.length === 0
      ? "--require-overlay was given and no overlay dictionary was merged."
      : `--require-overlay was given and the ${dictionaries.length} merged ` +
        `${dictionaries.length === 1 ? "overlay" : "overlays"} ` +
        `(${dictionaries.map((entry) => entry.label).join(", ")}) declared no terms at all.`;
  return (
    `${opening}\n` +
    "This repository ships no dictionary of its own, so this run would have checked no name, no " +
    "figure and no domain word, printed PASSED and exited 0 — the same exit code as a complete run. " +
    "Merge an overlay that declares terms with --terms <path> or LEAK_TERMS."
  );
}

/**
 * How many links deep an overlay's name is followed: the shallower of the limits the kernels this
 * runs on impose (macOS 32, Linux 40). Past it there is a cycle rather than a path.
 */
const OVERLAY_LINK_HOPS = 32;

/**
 * Where an overlay's bytes would be read from, with a symlinked last component followed even when
 * that link dangles.
 *
 * `canonical_root` resolves through the kernel, which answers for a path only when every component
 * of it is there; an overlay named through a broken link falls back to `canonical`, and `canonical`
 * keeps a leaf's own name on purpose. So the guard's answer depended on whether the target happened
 * to exist: one link, pointing at one tracked dictionary, read as inside the tree while the file was
 * present and as outside it the moment the file was not — and the second answer is the one the
 * operator gets on the run that writes the overlay through that link.
 *
 * The chain is followed by hand and lexically, each target resolved against the directory its link
 * sits in, which is how the kernel reads a relative target. A link that points at itself or into a
 * cycle stops at the last name reached and is compared as that name, because a name is all there is
 * to compare and refusing to answer would let the case through.
 */
function overlay_target(dictionary: string): string {
  let here = resolve(dictionary);
  for (let hop = 0; hop < OVERLAY_LINK_HOPS; hop += 1) {
    let target: string;
    try {
      target = readlinkSync(here);
    } catch {
      // Not a link, or not there at all: either way this is the name the bytes would be read from.
      return here;
    }
    const next = resolve(dirname(here), target);
    if (next === here) {
      return here;
    }
    here = next;
  }
  return here;
}

/**
 * Whether an overlay sits inside the tree this run is about to read, and why that is refused.
 *
 * A dictionary's own terms are muted inside it, so an overlay committed into the tree being
 * scanned is the one file its vocabulary can never be reported in — the exact failure the split
 * dictionary exists to prevent, and a run that reaches a verdict over it prints PASSED over the
 * disclosure.
 *
 * The comparison is the whole of it, and it was wrong. `root` arrives from
 * `git rev-parse --show-toplevel`, which answers with the directory the kernel resolved; the
 * dictionary arrived from `resolve`, which is lexical and leaves symlinks standing. One spelling
 * of `/tmp` against another of `/private/tmp` made `relative` open with `..`, the guard read that
 * as "outside the repository", and the run it let through committed the overlay into the scan and
 * exited 0. Both sides go through a full resolution here so that no caller can hand this a
 * spelling that defeats it — see `under` for why a file called `..notes` is inside too.
 *
 * Both spellings of the overlay are tested, the name as given and the bytes it resolves to, and
 * either one inside the tree is a refusal. They are two different disclosures. `canonical` keeps a
 * leaf's own name because a scanned symlink is content the walk reports under that name, and
 * `--terms` is not scanned, it is *read* — so a link standing outside the tree and naming a
 * dictionary tracked inside it refused when spelt directly and was accepted through the link, one
 * file and one disclosure with two verdicts, which is why the target is resolved here at all
 * (`overlay_target` follows that leaf whether or not the target exists yet, so the answer never
 * turns on the order the operator created the two). The mirror is as bad and is the case resolving
 * alone let through: a link standing *inside* the tree and naming a dictionary outside it is a
 * tracked file whose recorded content is the overlay's path, the path may be the engagement's own
 * name, and the terms of the dictionary are suppressed in the file that supplied it — so the run
 * printed PASSED over a committed file naming the client. Measured, on a fixture repository: one
 * occurrence suppressed inside the dictionary that declares it, verdict PASSED, exit 0.
 *
 * The refusal names the overlay by ordinal. The path is the operator's and may be vocabulary; the
 * operator knows which of their own `--terms` arguments this was. See `dictionary_labels`.
 */
function overlay_inside_scan(root: string, dictionary: string, label: string): string | null {
  const tree = canonical_root(root);
  if (under(tree, canonical(dictionary)) === null && under(tree, canonical_root(overlay_target(dictionary))) === null) {
    return null;
  }
  return (
    `Overlay dictionary inside the tree being scanned: ${label}.\n` +
    "A dictionary's own terms are suppressed inside it, so an overlay here would put its vocabulary in " +
    "the single file the gate cannot report it in, and the run would pass over the disclosure. Keep the " +
    "overlay outside this repository and merge it by path with --terms or LEAK_TERMS."
  );
}

/**
 * Every place this file writes a line, and what `--quiet` does to it.
 *
 * The rule, first, because the table is only an audit of it. The dictionary is a private secret
 * and this gate runs in CI on a public repository, whose logs are world-readable. So nothing this
 * program prints may carry the overlay's content — a term, a category name, a `why`, or the text
 * of a line a term was found in — unless `--quiet` is off. Counts of those things are not those
 * things and are printed always, because a gate whose output could be silenced into looking like
 * a clean pass is worse than a loud one. Errors are the case the flag cannot cover at all: they go
 * to stderr before there is a report to silence, so they carry a coordinate instead. See
 * `Refusal`.
 *
 * **An overlay's path is its content, not a coordinate.** It was read as diagnostic for as long as
 * the only path CI supplied was `$RUNNER_TEMP/leak-terms.json`, which holds no vocabulary. The
 * workflow's other documented way to supply an overlay is to check the private repository out and
 * point `--terms` at it, and the private repository's own name is a term the dictionary declares —
 * so the header put a declared term on a world-readable log on every run of every step, `--quiet`
 * included, because the line it sat on is a count and counts are never silenced. No overlay path
 * is printed anywhere now, on either stream, at either volume: `dictionary_labels` says which of
 * the paths the operator gave, and `Dictionary` carries no path to print by accident. `shorten` is
 * for repository paths, which are this public repository's own.
 *
 * The table exists because the recurring defect here is not an unguarded block, it is an unguarded
 * block *beside a guarded one* — three separate rounds have now fixed one and left its neighbour.
 * Add a print site, add its row.
 *
 *   report_dictionaries   dictionary and term counts, per-file counts     always
 *                         which of the --terms paths each one was          always — an ordinal
 *                         categories a later overlay extended                by name only when loud
 *                         duplicate term and exemption counts               always
 *                         "no vocabulary loaded" advisory                   always
 *   report                one line per hit: term, category, why, the text   loud only
 *                         hits by category                                  loud only
 *                         not read / read in part, each named               always — repository paths
 *                         "exemptions not resolved" count                   always
 *                         each unresolved entry: its term and path          loud only
 *                         active and suppressed counts                      always
 *                         "exemption errors: N"                             always
 *                         each rejected exemption, with its reason          loud only
 *                         PASSED / PASSED WITH GAPS / FAILED and the scope   always — counts only
 *   audit_allowlist       active and rejected counts, the overlay ordinals  always
 *                         one entry per line: path, term, category, why     loud only
 *                         each rejected exemption                           loud only
 *                         Audit PASSED / FAILED and its counts              always
 *   self_test             fixture counts, "N checks failed", the verdict    always — never which
 *   print_usage           fixed text                                        always
 *   main                  a bad argument, echoed                            always — from argv
 *                         "not inside a git repository"                     always — repository paths
 *                         the overlay-inside-the-scan refusal                always — an ordinal
 *                         the failure, on stderr, exit 2                    always — a `Refusal` or
 *                                                                           an error raised after
 *                                                                           the dictionary is closed
 *
 * The one path an operator supplies that is still echoed is `--path`, in the scope line and in the
 * not-a-repository advisory. It names the tree this run was pointed at, which in every documented
 * invocation is this public repository or a directory inside it; point it at a private checkout
 * on a public runner and that name is published, as it would be by the `run:` line Actions echoes
 * before this program starts. That is a property of the invocation, not of the dictionary.
 */

/**
 * Printed on every run, quiet included: a narrower dictionary must never look like a full pass.
 *
 * Every count here survives `--quiet`, because a count of a dictionary is not the dictionary. The
 * one thing that does not is the list of category names a later file extended, which is overlay
 * content and was printed unguarded beside four neighbouring lines that carry only numbers. Quiet
 * keeps the fact that a merge extended rather than replaced, which is what the line is for.
 *
 * What names each row is an ordinal and never a path; see `dictionary_labels`.
 */
function report_dictionaries(loaded: Dictionary[], quiet: boolean): void {
  console.log(`Dictionaries: ${describe_dictionaries(loaded)}.`);
  for (const entry of loaded) {
    const terms = `${entry.terms} ${entry.terms === 1 ? "term" : "terms"}`;
    const categories = `${entry.categories} ${entry.categories === 1 ? "category" : "categories"}`;
    const exemptions = entry.exemptions === 0 ? "" : `, ${entry.exemptions} exemptions`;
    console.log(`  ${terms.padStart(9)} in ${categories}${exemptions}  ${entry.label}`);
    if (entry.merged.length > 0) {
      const extended = `${entry.merged.length} ${entry.merged.length === 1 ? "category" : "categories"}`;
      console.log(
        quiet
          ? `    ${extended} extended rather than replaced`
          : `    extended rather than replaced: ${entry.merged.join(", ")}`,
      );
    }
    if (entry.duplicate_terms > 0) {
      console.log(
        `    ${entry.duplicate_terms} ${entry.duplicate_terms === 1 ? "term was" : "terms were"} already ` +
          "defined earlier; the first definition stands, so the reason printed on a hit is that one",
      );
    }
    if (entry.duplicate_exemptions > 0) {
      console.log(
        `    ${entry.duplicate_exemptions} ${entry.duplicate_exemptions === 1 ? "exemption was" : "exemptions were"} ` +
          "already recorded earlier for the same occurrence and the same reason; the first entry stands, so " +
          "the active count and --audit read it once",
      );
    }
  }
  if (loaded.reduce((sum, entry) => sum + entry.terms, 0) === 0) {
    console.log(
      "  No vocabulary loaded (--terms <path>, LEAK_TERMS). This repository ships no dictionary of its " +
        "own, so this run can find nothing. Pass --require-overlay wherever this runs as a gate.",
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

  // Category names are the overlay's own taxonomy, and this block has content exactly when the run
  // is red — which on a public repository is exactly when a world-readable log gets written. It sat
  // unguarded between the hit lines above and the unresolved entries below, both of which are held
  // behind this same flag for this same reason. The count it carries is not lost: the verdict line
  // below says how many categories the hits fall in.
  if (by_category.size > 0 && !quiet) {
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
  let unread = 0;
  let drifted = 0;
  let rewritten = 0;
  let unanchored = 0;
  let uncovered = 0;
  const sources = [...new Set(exemptions.map((entry) => entry.source))];
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
        // `file_occurrences` guards its own read and answers "no occurrences" for a file it could
        // not open, so this read is the one place an unreadable path surfaced — and it was bare,
        // which aborted the whole audit at exit 2 on a raw errno, with no verdict for this entry
        // or any of the ones after it. An entry whose file could not be read is not thereby
        // stale: nothing was checked, and "STALE" would accuse it of something this run never
        // established.
        let bytes: Buffer | null = null;
        try {
          bytes = readFileSync(absolute);
        } catch (failure) {
          const code = (failure as NodeJS.ErrnoException).code;
          if (code !== "EACCES" && code !== "EPERM") {
            throw failure;
          }
        }
        if (bytes === null) {
          unread += 1;
          status = "UNREAD — the file is there and its mode refuses the read, so this entry could not be checked";
        } else {
          status =
            read_text(bytes) === null
              ? "STALE — the file is not text and holds no readable run, so nothing in it can be matched"
              : "STALE — the file no longer contains this term";
        }
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
  const gaps =
    unread === 0
      ? ""
      : ` ${unread} ${unread === 1 ? "entry names a file" : "entries name files"} this run may not read, so ` +
        `${unread === 1 ? "it was" : "they were"} not checked at all and nothing here is known about ` +
        `${unread === 1 ? "it" : "them"}; each is named above.`;
  if (stale === 0 && drifted === 0 && rewritten === 0 && rejected.length === 0) {
    console.log(
      unread === 0
        ? `Audit PASSED — every exemption still covers the occurrence it was written for.${loose}${unchecked}`
        : "Audit PASSED WITH GAPS — every exemption that could be read still covers the occurrence it was " +
            `written for.${gaps}${loose}${unchecked}`,
    );
    return 0;
  }
  console.log(
    `Audit FAILED — ${drifted} drifted onto a different occurrence, ${rewritten} anchored on a sentence that has ` +
      `since been rewritten, ${stale} stale, ${rejected.length} rejected.${gaps}${loose}${unchecked} Delete what ` +
      "no longer applies, re-read what has drifted or changed before moving it, and give every remaining entry a " +
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

/** One version of one path, and the commit whose tree first held it. */
type Version = { blob: string; commit: string };

type Versions = {
  repository: string;
  path: string;
  versions: Version[];
  /** A second path, deleted and restored byte for byte, and the two commits that each added it. */
  restored: string;
  homes: string[];
};

/**
 * The attribution case, built here rather than measured against the repository, because the
 * history this reproduced in is the history a scrub is about to rewrite and a test tied to it dies
 * with it.
 *
 * One path holds three versions across three commits, with the term on a different line in each,
 * so a hit says which blob it came out of without the label having to. A fourth commit deletes
 * that path and writes the content somewhere else: `--find-object` on the third blob answers with
 * a commit whose tree does not hold the path at all, and which — when the walk is given the third
 * commit as its range — is outside that range entirely, being a descendant of it.
 *
 * A second path is committed, deleted and committed again byte for byte, so one blob has two
 * homes and neither of them may be dropped from the label.
 */
function plant_versions(directory: string): Versions {
  const repository = join(directory, "versions-fixture");
  const path = "versions/dispatch.md";
  const restored = "versions/restored.md";
  mkdirSync(join(repository, "versions"), { recursive: true });
  Bun.spawnSync(["git", "init", "--quiet", "-b", "main", repository], { stdout: "pipe", stderr: "pipe" });
  const commit = (message: string): string => {
    Bun.spawnSync(["git", "add", "-A"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    const made = Bun.spawnSync(
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
    if (made.exitCode !== 0) {
      throw new Error(`self-test could not commit a version: ${made.stderr.toString()}`);
    }
    const named = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
    return named.stdout.toString().trim();
  };
  const restored_body = "the restored copy carries zarquilon\n";
  const versions: Version[] = [];
  const homes: string[] = [];
  const bodies = [
    "the first version carries zarquilon\n",
    "an ordinary line\nthe second version carries zarquilon\n",
    "an ordinary line\nanother ordinary line\nthe third version carries zarquilon\n",
  ];
  for (const [index, body] of bodies.entries()) {
    writeFileSync(join(repository, path), body);
    // Added, taken away, and put back byte for byte: two additions of one object.
    if (index === 1) {
      rmSync(join(repository, restored));
    } else {
      writeFileSync(join(repository, restored), restored_body);
    }
    const sha = commit(`version ${index + 1}`);
    if (index !== 1) {
      homes.push(sha);
    }
    const blob = Bun.spawnSync(["git", "rev-parse", `HEAD:${path}`], {
      cwd: repository,
      stdout: "pipe",
      stderr: "pipe",
    });
    versions.push({ blob: blob.stdout.toString().trim(), commit: sha });
  }
  rmSync(join(repository, path));
  mkdirSync(join(repository, "moved"), { recursive: true });
  writeFileSync(
    join(repository, "moved/dispatch.md"),
    "a fourth line\nan ordinary line\nanother ordinary line\nthe moved version carries zarquilon\n",
  );
  commit("move the path away");
  return { repository, path, versions, restored, homes };
}

type Merges = {
  repository: string;
  /** The hand-resolved conflict whose blob a later commit replaces. */
  resolved: { path: string; commit: string };
  /** A hand-resolved conflict nothing ever removes, on a branch that is not checked out. */
  kept: { path: string; commit: string };
  /** A three-parent merge whose resolution matched none of the three. */
  octopus: { path: string; commit: string };
  /** A merge that took its second parent's file whole, and the commit that actually wrote it. */
  inherited: { path: string; commit: string };
  /** A commit id that names no object in this repository. */
  absent: string;
  /**
   * A path holding exactly one space. `git cat-file --batch-check` echoes a request it cannot
   * resolve and appends ` missing`, so the answer for the sibling name below has three
   * space-separated fields exactly as a resolved answer does, and only the first field's shape
   * tells them apart.
   */
  spaced: string;
  /** The same name, one word changed, naming nothing this repository holds. */
  spaced_absent: string;
};

/**
 * Merges, which `git log` does not diff unless it is told to, and which is where a hand-edited
 * conflict resolution lives.
 *
 * Four shapes, because they fail in four directions:
 *
 * - a two-parent conflict resolved by hand and replaced by a later commit. Without `-c` the
 *   resolution is not a candidate at all, the later commit is rejected for not holding the blob,
 *   and the fallback printed that rejected candidate anyway: `added in` naming the one commit in
 *   the graph that never held the secret.
 * - the same resolution with nothing removing it and its branch not checked out. There git lists
 *   no candidate whatsoever, and the label read `no commit in the scanned range adds it` about a
 *   commit sitting in the range adding it.
 * - a three-parent resolution, because `-m` would name it once per parent and a reader would be
 *   sent to cut three times at one commit.
 * - a merge that took its second parent's file unchanged. Every spelling that diffs merges makes
 *   this one a candidate, and only the parent comparison keeps the label off it: the commit that
 *   wrote those bytes is on the branch, not at the merge.
 *
 * The octopus is built with `commit-tree` because `git merge` refuses to resolve a conflicting
 * octopus at all; the two-parent cases are merged the way a person would hit them.
 */
function plant_merges(directory: string): Merges {
  const repository = join(directory, "merge-fixture");
  mkdirSync(repository, { recursive: true });
  const git = (...args: string[]): string => {
    const run = Bun.spawnSync(
      ["git", "-c", "user.email=self-test@example.invalid", "-c", "user.name=self test", ...args],
      { cwd: repository, stdout: "pipe", stderr: "pipe" },
    );
    return run.stdout.toString().trim();
  };
  // `git merge` stops on the conflict and leaves the index staged for a person to fix, which is
  // the state every one of these resolutions is written into.
  const resolve_conflict = (branch: string, path: string, body: string, message: string): string => {
    git("merge", "--no-commit", "--no-ff", branch);
    writeFileSync(join(repository, path), body);
    git("add", "-A");
    git("commit", "--no-verify", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const spaced = "notes/awkward name.md";
  const spaced_absent = "notes/absent name.md";
  mkdirSync(join(repository, "notes"), { recursive: true });
  git("init", "--quiet", "-b", "main", ".");
  writeFileSync(join(repository, "conflict.md"), "the base version\n");
  writeFileSync(join(repository, "kept.md"), "the base version\n");
  writeFileSync(join(repository, "octopus.md"), "the base version\n");
  writeFileSync(join(repository, "inherited.md"), "the base version\n");
  writeFileSync(join(repository, spaced), "an ordinary line under an awkward name\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "the common ancestor");
  const base = git("rev-parse", "HEAD");
  // One side branch per path, each holding a version the other side never saw.
  for (const [branch, path, body] of [
    ["side-conflict", "conflict.md", "the side version\n"],
    ["side-kept", "kept.md", "the side version\n"],
    ["side-inherited", "inherited.md", "the bytes the merge takes whole, carrying zarquilon\n"],
    ["octopus-x", "octopus.md", "the x version\n"],
    ["octopus-y", "octopus.md", "the y version\n"],
  ] as Array<[string, string, string]>) {
    git("checkout", "--quiet", base);
    git("checkout", "--quiet", "-b", branch);
    writeFileSync(join(repository, path), body);
    git("add", "-A");
    git("commit", "--no-verify", "--quiet", "-m", `${branch} writes its own version`);
  }
  const inherited_commit = git("rev-parse", "side-inherited");

  // The resolution a later commit replaces. Its branch stays checked out for now.
  git("checkout", "--quiet", "main");
  writeFileSync(join(repository, "conflict.md"), "the main version\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "main writes its own version");
  const resolved = resolve_conflict(
    "side-conflict",
    "conflict.md",
    "neither side wrote this, and it carries zarquilon\n",
    "resolve the conflict by hand",
  );
  writeFileSync(join(repository, "conflict.md"), "and now something else entirely\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "replace the resolved version");

  // The resolution nothing removes, on a branch this repository does not check out.
  git("checkout", "--quiet", base);
  git("checkout", "--quiet", "-b", "keeps-it");
  writeFileSync(join(repository, "kept.md"), "the other version\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "keeps-it writes its own version");
  const kept = resolve_conflict(
    "side-kept",
    "kept.md",
    "this resolution is never removed, and it carries zarquilon\n",
    "resolve the second conflict by hand",
  );

  // The merge that takes its second parent's file whole: the bytes are the branch's, so the
  // branch commit is the addition and the merge is not.
  git("checkout", "--quiet", base);
  git("checkout", "--quiet", "-b", "takes-theirs");
  writeFileSync(join(repository, "inherited.md"), "the version the merge throws away\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "takes-theirs writes a version to discard");
  git("merge", "--no-commit", "--no-ff", "side-inherited");
  writeFileSync(join(repository, "inherited.md"), "the bytes the merge takes whole, carrying zarquilon\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "take the branch's file whole");

  // The octopus, by plumbing, because `git merge` will not resolve a conflicting one.
  git("checkout", "--quiet", "octopus-x");
  writeFileSync(join(repository, "octopus.md"), "no parent wrote this, and it carries zarquilon\n");
  git("add", "-A");
  const octopus = git(
    "commit-tree",
    git("write-tree"),
    "-p",
    "octopus-x",
    "-p",
    "octopus-y",
    "-p",
    base,
    "-m",
    "resolve three parents at once",
  );
  git("checkout", "--quiet", "--detach", octopus);
  git("checkout", "--quiet", "-b", "octopus-merge");
  git("reset", "--quiet", "--hard", octopus);

  // Nothing holding a term is in the checked-out tree, so every one of these is history.
  git("checkout", "--quiet", "main");
  return {
    repository,
    resolved: { path: "conflict.md", commit: resolved },
    kept: { path: "kept.md", commit: kept },
    octopus: { path: "octopus.md", commit: octopus },
    inherited: { path: "inherited.md", commit: inherited_commit },
    // A well-formed id of the right width for this repository that names nothing in it.
    absent: `${base.slice(0, -1)}${base.endsWith("0") ? "1" : "0"}`,
    spaced,
    spaced_absent,
  };
}

type Carried = {
  repository: string;
  path: string;
  /** A range that starts after the blob arrived, spelled as one token the way `--history` takes it. */
  range: string;
  /** The one commit in that range whose tree holds the blob, which inherited it from outside. */
  holder: string;
  /** The oldest commit the range lists, whose diff takes the blob away and whose tree lacks it. */
  removal: string;
};

/**
 * A range that begins after the blob arrived, which is the case the fallback exists for and the
 * case it used to get wrong.
 *
 * `--history` takes any rev-list spelling, and `A...B` drops the commits both sides share. So the
 * commit that added the blob can sit outside the walk while commits that *hold* it sit inside it.
 * Here one side replaces the file and the other copies its bytes to a second name: git lists the
 * replacement, whose tree does not hold the blob at all, and the copy, whose tree does and whose
 * parent's does too. Nothing in the range adds it, so nothing may be labelled as adding it — and
 * the oldest commit git listed, which is what the old fallback printed, is the replacement.
 *
 * The dates are fixed because the whole point is which commit git lists last, and two commits
 * written in one second are ordered by nothing this test should depend on.
 */
function plant_carried(directory: string): Carried {
  const repository = join(directory, "carried-fixture");
  mkdirSync(repository, { recursive: true });
  const path = "carried.md";
  let clock = 0;
  const git = (...args: string[]): string => {
    clock += 60;
    const stamp = `${1700000000 + clock} +0000`;
    const run = Bun.spawnSync(
      ["git", "-c", "user.email=self-test@example.invalid", "-c", "user.name=self test", ...args],
      {
        cwd: repository,
        env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    return run.stdout.toString().trim();
  };
  git("init", "--quiet", "-b", "main", ".");
  writeFileSync(join(repository, path), "the version carried in from outside, holding zarquilon\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "the arrival, which the range below leaves out");
  const arrival = git("rev-parse", "HEAD");
  // One side replaces the file, so its diff takes the blob away and its tree does not hold it.
  writeFileSync(join(repository, path), "and now something else entirely\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "replace what arrived");
  const removal = git("rev-parse", "HEAD");
  // The other copies those bytes to a second name, so its diff touches the object while its tree
  // goes on holding it at the original path — inherited, not added. Committed last, so git lists
  // it first and the replacement is the oldest answer.
  git("checkout", "--quiet", arrival);
  git("checkout", "--quiet", "-b", "copies-it");
  writeFileSync(join(repository, "second-name.md"), "the version carried in from outside, holding zarquilon\n");
  git("add", "-A");
  git("commit", "--no-verify", "--quiet", "-m", "file the same bytes under a second name");
  const holder = git("rev-parse", "HEAD");
  git("checkout", "--quiet", "main");
  return { repository, path, range: "main...copies-it", holder, removal };
}

/**
 * What a failing self-test may say about which of its checks failed, as the lines to print.
 *
 * With an overlay merged the self-test plants every term of every loaded category, and two checks
 * name the term they failed on — so printing them would publish the private vocabulary. This
 * repository is public and its CI logs are world-readable, so a broken matcher would put out the
 * words the dictionary exists to keep out. Note which way that cuts: a secret rotated to `{}` is
 * safe here and a *working* overlay is the dangerous one, which is the opposite of the intuition.
 *
 * With no overlay category loaded there is nothing to withhold, and the checks are printed in
 * full. Every value a check interpolates is then a count, a duration, a string written in this
 * file, or a name out of a fixture repository this run built under `tmpdir()` — the two checks
 * that name a term read it out of `SELF_TEST_CATEGORIES`, whose vocabulary is invented here and
 * names nobody. That case is not an edge: it is how this repository's own CI runs the self-test,
 * and it is what the printed line promised for five commits with no code path behind it.
 *
 * The argument is the set of categories the fixtures were planted from, not a count of the loaded
 * ones, so the rule and the risk read the same binding and cannot drift apart: a category is safe
 * to print about when it is one of this file's own, by identity and not by name — an overlay that
 * names a category `self_test_fixture` arrives as a category of its own, and comparing names would
 * hand its terms to the loop below. That it is a property of what was planted rather than a flag
 * matters for the same reason: a flag can be dropped from a workflow by someone who does not know
 * any of this. The count is printed either way, and never behind `--quiet`: a failing self-test
 * means the checker is broken, and that needs no vocabulary to state.
 */
function self_test_failures(failures: string[], planted: TermCategory[]): string[] {
  const count = `${failures.length} self-test ${failures.length === 1 ? "check" : "checks"} failed.`;
  if (planted.every((category) => SELF_TEST_CATEGORIES.includes(category))) {
    return [`  ${count}`, ...failures.map((failure) => `    ${failure}`)];
  }
  return [
    `  ${count} Which ones is withheld: an overlay is merged, a check names the term it failed on, and ` +
      "this stream is a world-readable log. Read them where there is nothing loaded to publish — run " +
      "--self-test again with no --terms and no LEAK_TERMS, which plants only the vocabulary invented in " +
      "this file and prints every check that fails. A check that fails only while an overlay is merged " +
      "will not fail there, and this count is all this stream will ever say about that one.",
  ];
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
    // Checks this environment could not exercise at all. A skipped check is not a passing one, and
    // the verdict has to be able to tell them apart: the mode-000 fixture below is skipped for any
    // user who reads a mode-000 file regardless — root, which is the ordinary shape of a CI
    // container — so on that machine the guard it exists for went untested while the harness still
    // printed a flat PASSED. Deleting the guard outright would not have changed a thing it said.
    const skipped: string[] = [];
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

    // And the same rule end to end, which is the precondition `overlay_inside_scan` exists to
    // defend rather than a second look at `scan_text`. The case above hands the muting a set built
    // by hand; nothing asserted that a dictionary passed as --terms is muted in the file that holds
    // it, nor that the muting is keyed on that file's own path — and the guard is only worth having
    // because both are true. Take either away and every guard case still passes while the guard
    // protects nothing, which is why this sits here rather than beside it.
    //
    // The key is the path `canonical` gives the file, on both sides: `load_dictionaries` stores it
    // under the spelling it was handed, `scan_files` asks for the spelling it resolved, and `main`
    // is what pairs them by canonicalising every --terms argument. A second copy of the same bytes
    // under another name is reported, because a name is not content.
    const muted = join(directory, "muted-dictionary");
    mkdirSync(muted, { recursive: true });
    const muted_body = JSON.stringify({
      categories: [{ name: "self_test_muted", why: "fixture", terms: [{ term: "zarquilon", why: "fixture" }] }],
    });
    const muted_terms = join(muted, "leak-terms.json");
    const muted_copy = join(muted, "copy-of-the-dictionary.json");
    writeFileSync(muted_terms, muted_body);
    writeFileSync(muted_copy, muted_body);
    const muted_load = load_dictionaries([canonical(muted_terms)]);
    const muted_scan = scan_files(
      [muted_terms, muted_copy],
      build_matchers(muted_load.categories),
      muted,
      muted_load.quoted,
      null,
      null,
    );
    if (muted_scan.self_quoted === 0 || muted_scan.hits.some((hit) => hit.source === "leak-terms.json")) {
      failures.push(
        "a dictionary passed as --terms was reported against its own declared term, so the muting the " +
          "overlay guard exists to compensate for is not keyed on the file that supplied the dictionary",
      );
    }
    if (!muted_scan.hits.some((hit) => hit.source === "copy-of-the-dictionary.json" && hit.term === "zarquilon")) {
      failures.push(
        "a second file carrying a dictionary's bytes under another name was muted along with it, so the " +
          "muting is keyed on content rather than on a path and the overlay guard measures the wrong thing",
      );
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
      {
        label: "the overlay given to --terms",
        terms: 0,
        categories: 0,
        merged: [],
        duplicate_terms: 0,
        exemptions: 0,
        duplicate_exemptions: 0,
      },
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

    // Every message the dictionary path can fail with is published. `main` prints it to stderr and
    // returns 2, `--quiet` has never reached stderr, and on a public repository the CI log is
    // world-readable — so the assertion is that a coordinate comes out and the entry's own text
    // does not. `unquotable` stands in for a term, a category name and a `why` at once: it is a
    // bare identifier, so the not-JSON fixture is exactly the shape that made the engine's own
    // message quote a fragment of the secret back at the log.
    //
    // Every fixture below sits in a directory *named after* `unquotable`, because the path is the
    // other half of the same rule and was the half nobody checked. The workflow's second way to
    // supply an overlay is a checkout of the private repository, and the private repository's own
    // name is a term the dictionary declares — so each assertion here reads twice now: the message
    // may not quote the entry, and it may not quote the path the entry was read from.
    const unquotable = "vondrelmikashecoproprietor";
    const faults = join(directory, `${unquotable}-engagement`);
    mkdirSync(faults, { recursive: true });
    const overlay_terms = join(faults, "leak-terms.json");
    const dictionary_names = dictionary_labels([overlay_terms]);
    const overlay_label = dictionary_names[0] as string;
    if (overlay_label.includes(unquotable)) {
      failures.push(
        "the label standing in for an overlay's path was the path, so every message and every header " +
          "carrying it publishes whatever the operator called their private checkout",
      );
    }

    // A malformed overlay fails the run rather than loading as an empty one.
    for (const [name, body] of [
      ["broken.json", "{ not json"],
      ["array.json", "[]"],
      ["scalar.json", "42"],
      ["bad-categories.json", '{"categories": {}}'],
    ] as Array<[string, string]>) {
      const path = join(faults, name);
      writeFileSync(path, body);
      let refused = false;
      try {
        parse_dictionary(path, overlay_label);
      } catch {
        refused = true;
      }
      if (!refused) {
        failures.push(`a malformed overlay (${name}) loaded as an empty dictionary instead of failing the run`);
      }
    }

    for (const [name, body, coordinate] of [
      // Column 26 is where the bare identifier starts, which is exactly the fragment the engine's
      // own message would have quoted back into the log.
      ["fault-token.json", `{"categories": [{"name": ${unquotable}}]}`, "line 1, column 26"],
      ["fault-no-name.json", '{"categories": [{"terms": []}]}', "category 1"],
      ["fault-no-terms.json", `{"categories": [{"name": "${unquotable}"}]}`, "category 1"],
      [
        "fault-no-term.json",
        `{"categories":[{"name":"${unquotable}","terms":[{"term":"ok","why":"${unquotable}"},` +
          `{"term":"","why":"${unquotable}"}]}]}`,
        "category 1, term 2",
      ],
      [
        "fault-dead-term.json",
        `{"categories":[{"name":"${unquotable}","terms":[{"term":"\u200b\u00ad","why":"${unquotable}"}]}]}`,
        "category 1, term 1",
      ],
    ] as Array<[string, string, string]>) {
      const path = join(faults, name);
      writeFileSync(path, body);
      let message: string | null = null;
      try {
        parse_dictionary(path, overlay_label);
      } catch (failure) {
        message = failure instanceof Error ? failure.message : String(failure);
      }
      if (message === null) {
        failures.push(`a malformed overlay (${name}) loaded instead of failing the run`);
        continue;
      }
      const quoted_back = message.split(unquotable).length - 1;
      if (quoted_back !== 0) {
        failures.push(
          `the refusal for ${name} put the dictionary's own text or its path on stderr ${quoted_back} times, ` +
            "and stderr is the stream --quiet cannot reach",
        );
      }
      if (!message.includes(coordinate)) {
        failures.push(`the refusal for ${name} names no position, so it says something is wrong and never where`);
      }
    }

    // An overlay nothing can open is an IO failure, not a syntax one. Reading and parsing shared a
    // `try`, so a permission or device error was reported as invalid JSON and sent somebody hunting
    // for a missing brace in a file they were never allowed to read. A directory is the portable
    // way to make the open fail: `chmod 000` does not stop root, which is who CI often is.
    const unopenable = join(faults, "fault-not-a-file");
    mkdirSync(unopenable, { recursive: true });
    let io_message = "";
    try {
      parse_dictionary(unopenable, overlay_label);
    } catch (failure) {
      io_message = failure instanceof Error ? failure.message : String(failure);
    }
    if (io_message.includes("not valid JSON") || !io_message.includes("could not be read")) {
      failures.push("an overlay that could not be opened at all was reported as a syntax error");
    }
    if (io_message.includes(unquotable)) {
      failures.push("the open failure named the path it could not open, and the path is the private checkout");
    }

    // A missing overlay is the one dictionary failure with nothing to withhold: this file wrote
    // the sentence and the sentence names no file. It used to be a plain `Error`, which `main`'s
    // fence converted into `withheld` — telling an operator their message was suppressed because a
    // runtime error quotes what it choked on, when nothing had choked on anything and the file was
    // simply absent. The assertion is that it crosses the fence as itself.
    let missing: unknown = null;
    try {
      load_dictionaries([join(faults, "no-such-overlay.json")]);
    } catch (failure) {
      missing = failure;
    }
    if (!(missing instanceof Refusal)) {
      failures.push(
        "a missing overlay was not a Refusal, so main's fence discards the one message that says what is " +
          "actually wrong and reports a withheld runtime error instead",
      );
    }
    const missing_message = missing instanceof Error ? missing.message : String(missing);
    if (!missing_message.includes("not found")) {
      failures.push("a missing overlay was reported as something other than a missing overlay");
    }
    if (missing_message.includes(unquotable)) {
      failures.push("the missing-overlay refusal echoed the path it could not find, and that path is the secret");
    }

    // And an error the runtime raised, rather than one written here, never crosses at all — nor
    // does the list of what was being merged when it did.
    if (withheld(new Error(`choked on "${unquotable}"`), dictionary_names).message.includes(unquotable)) {
      failures.push("an error out of the runtime carried whatever it choked on to stderr, and that is the dictionary");
    }

    // What `--quiet` is actually for, asserted over both streams and by count. One guarded block
    // beside an unguarded neighbour is how this keeps recurring, so the loud run has to leak and
    // the quiet run has to leak nothing — a quiet report that prints nothing at all would pass the
    // second test alone and prove nothing.
    const streams = (act: () => void): { out: string; err: string } => {
      const out: string[] = [];
      const err: string[] = [];
      const log = console.log;
      const error = console.error;
      console.log = (...parts: unknown[]): void => {
        out.push(parts.map(String).join(" "));
      };
      console.error = (...parts: unknown[]): void => {
        err.push(parts.map(String).join(" "));
      };
      try {
        act();
      } finally {
        console.log = log;
        console.error = error;
      }
      return { out: out.join("\n"), err: err.join("\n") };
    };
    const named = (text: string): number => text.split(unquotable).length - 1;
    const disclosing: Hit = {
      source: "somewhere.md",
      line: 4,
      column: 7,
      span: 1,
      chars: unquotable.length,
      term: unquotable,
      category: `${unquotable}_category`,
      why: `${unquotable}_reason`,
      text: `a line carrying ${unquotable}`,
    };
    const verdict: Verdict = {
      reported: [disclosing],
      exempt: [],
      exemptions: 0,
      rejected: [`an exemption naming ${unquotable}`],
      scope: "a fixture",
      unread: [],
      partial: [],
      unresolved: [`an entry naming ${unquotable}`],
      quiet: false,
      dictionaries: [],
    };
    const loud_report = streams(() => {
      report(verdict);
    });
    const quiet_report = streams(() => {
      report({ ...verdict, quiet: true });
    });
    if (named(loud_report.out) + named(loud_report.err) === 0) {
      failures.push("the loud report named no term, category or reason at all, so the quiet one proves nothing");
    }
    if (named(quiet_report.out) + named(quiet_report.err) !== 0) {
      failures.push(
        `a quiet report put the dictionary on stdout ${named(quiet_report.out)} times and on stderr ` +
          `${named(quiet_report.err)} times; every one of them lands in a world-readable CI log`,
      );
    }
    if (!quiet_report.out.includes("FAILED")) {
      failures.push("a quiet report dropped the verdict along with the detail, and the verdict is the whole point");
    }
    // The same rule for the header, whose merge line names the categories a later file extended.
    const extending: Dictionary[] = [
      {
        label: overlay_label,
        terms: 1,
        categories: 1,
        merged: [`${unquotable}_category`],
        duplicate_terms: 0,
        exemptions: 0,
        duplicate_exemptions: 0,
      },
    ];
    const loud_header = streams(() => {
      report_dictionaries(extending, false);
    });
    const quiet_header = streams(() => {
      report_dictionaries(extending, true);
    });
    if (named(loud_header.out) === 0) {
      failures.push("the loud header named no category, so the quiet header proves nothing");
    }
    if (named(quiet_header.out) + named(quiet_header.err) !== 0) {
      failures.push("a quiet header printed the categories a later overlay extended, which is the overlay's taxonomy");
    }
    if (!quiet_header.out.includes("extended rather than replaced")) {
      failures.push("a quiet header dropped the fact of the merge, so a partial dictionary reads as a full one");
    }

    // What a failing self-test may say about which checks failed, which is the same stream rule one
    // level up: with an overlay category among the planted ones, every term of it is the overlay's
    // own vocabulary and two of the checks name the term they failed on, so the count is the whole
    // report. With only this file's own categories planted there is nothing to withhold and every
    // check is printed — the case this repository's own CI runs, and the one the line used to
    // promise with no code behind it.
    //
    // The sets are passed as the categories themselves, the way `self_test` passes the ones it
    // planted, so a call site handing the helper some other set could not stay green on a count.
    // The third shape is the one a comparison by name would get wrong: an overlay may declare a
    // category called `self_test_fixture`, and its terms are still the overlay's.
    const failing = [`a planted term was not found: ${unquotable}`, "and a second check that also failed"];
    const overlay_category: TermCategory = {
      name: "self_test_fixture",
      why: "fixture",
      terms: [{ term: unquotable, word_boundary: false, why: "fixture" }],
    };
    const printed_checks = self_test_failures(failing, [...SELF_TEST_CATEGORIES]).join("\n");
    const withheld_checks = self_test_failures(failing, [...SELF_TEST_CATEGORIES, overlay_category]).join("\n");
    const withheld_alone = self_test_failures(failing, [overlay_category]).join("\n");
    for (const [shape, report] of [
      ["beside this file's own", withheld_checks],
      ["as the only category planted", withheld_alone],
    ] as Array<[string, string]>) {
      if (named(report) !== 0) {
        failures.push(
          `a failing self-test with an overlay category planted ${shape} printed the term a check named ` +
            `${named(report)} times, and the terms the checks name are then the overlay's own`,
        );
      }
      if (report.includes(failing[1] as string)) {
        failures.push(
          `a failing self-test with an overlay category planted ${shape} printed a check's text, and a ` +
            "check's text is where the planted terms are",
        );
      }
    }
    if (!printed_checks.includes(failing[0] as string) || !printed_checks.includes(failing[1] as string)) {
      failures.push(
        "a failing self-test with nothing but this file's own categories planted still did not print the " +
          "checks that failed, so an operator following the line above it is being sent to do something no " +
          "code path does",
      );
    }
    for (const report of [printed_checks, withheld_checks, withheld_alone]) {
      if (!report.startsWith("  2 self-test checks failed.")) {
        failures.push(
          "a failing self-test dropped the count of failed checks, which is the one thing it may say at " +
            "either volume and with anything loaded",
        );
      }
    }

    // The header line the counts sit on, with an overlay whose *path* is the disclosure.
    //
    // This is the case `--quiet` was never able to cover and nobody had asked it to. The line
    // carries a term count, counts are printed always by design, and the path was printed beside
    // them exactly as the operator typed it — so an operator who followed the workflow's second
    // documented option, a checkout of the private repository, published its name on stdout on
    // every run of every step. The residue was read as benign because the option CI is wired to
    // writes the secret to `$RUNNER_TEMP/leak-terms.json`, which holds no vocabulary; its sibling
    // was never checked. Loud and quiet are both asserted, because stdout is the same log either
    // way and this one is not a volume control.
    const named_path: Dictionary[] = [
      {
        label: dictionary_labels([join(faults, "checkout", "leak-terms.json")])[0] as string,
        terms: 3,
        categories: 2,
        merged: [],
        duplicate_terms: 0,
        exemptions: 4,
        duplicate_exemptions: 0,
      },
    ];
    const loud_path_header = streams(() => {
      report_dictionaries(named_path, false);
    });
    const quiet_path_header = streams(() => {
      report_dictionaries(named_path, true);
    });
    const echoed =
      named(loud_path_header.out) +
      named(loud_path_header.err) +
      named(quiet_path_header.out) +
      named(quiet_path_header.err);
    if (echoed !== 0) {
      failures.push(
        `the header printed an overlay's own path ${echoed} times across the two volumes, and an overlay's ` +
          "path is the private repository's name",
      );
    }
    if (!quiet_path_header.out.includes("3 terms") || !quiet_path_header.out.includes("4 exemptions")) {
      failures.push(
        "the header dropped the counts along with the path, and the counts are why the line survives --quiet",
      );
    }

    // The refusal that keeps an overlay out of the tree being scanned, against the one input that
    // defeated it: two spellings of one directory.
    //
    // `git rev-parse --show-toplevel` answers with the path the kernel resolved and `resolve` does
    // not resolve anything, so on this machine a repository under `/tmp` is `/private/tmp/...` to
    // one side of the comparison and `/tmp/...` to the other. `relative` between them opens with
    // `..`, the guard read that as "the overlay is outside the repository", and the run went ahead
    // and scanned the overlay with its own vocabulary muted inside it — PASSED, exit 0, over the
    // one file holding the dictionary. A symlink reproduces it exactly and everywhere.
    const guarded = join(directory, "guard-real");
    mkdirSync(guarded, { recursive: true });
    const guard_terms = join(guarded, "leak-terms.json");
    writeFileSync(guard_terms, '{"categories":[]}');
    const spelt = join(directory, "guard-link");
    symlinkSync(guarded, spelt);
    if (overlay_inside_scan(guarded, join(spelt, "leak-terms.json"), overlay_label) === null) {
      failures.push(
        "an overlay inside the tree being scanned was let through because the root and the overlay were " +
          "spelt differently, and the run it allows prints PASSED over the file holding the dictionary",
      );
    }
    if (overlay_inside_scan(spelt, guard_terms, overlay_label) === null) {
      failures.push("the same disagreement the other way round — a symlinked root against a resolved overlay");
    }
    if (overlay_inside_scan(guarded, guard_terms, overlay_label) === null) {
      failures.push("an overlay plainly inside the tree being scanned was not refused at all");
    }
    // Every case above symlinks a *directory*, which `canonical` already resolved, so all three
    // passed while the leaf went unchecked. A link whose last component is the overlay refused
    // when named directly and was accepted through the link — one file, one disclosure, two
    // verdicts. `canonical` keeps a leaf's own name on purpose, because a scanned symlink is
    // content the walk reports under that name; an overlay is read rather than scanned, so here
    // the question is which bytes load and the leaf resolves too.
    const linked_leaf = join(directory, "guard-leaf.json");
    symlinkSync(guard_terms, linked_leaf);
    if (overlay_inside_scan(guarded, linked_leaf, overlay_label) === null) {
      failures.push(
        "an overlay reached through a symlink standing outside the tree was let through, though the file " +
          "it names is tracked inside it and is refused when spelt directly",
      );
    }
    // A link that dangles must not read as outside the tree by accident of being unresolvable.
    const dangling = join(directory, "guard-dangling.json");
    symlinkSync(join(guarded, "absent-terms.json"), dangling);
    if (overlay_inside_scan(guarded, dangling, overlay_label) === null) {
      failures.push(
        "a broken symlink pointing inside the tree was treated as living outside it, so the guard's answer " +
          "depended on whether the target happened to exist",
      );
    }
    // And the mirror, which resolving the leaf on its own let through: a link standing *inside* the
    // tree that names a dictionary outside it. The vocabulary is outside, so the resolved spelling
    // says nothing is wrong — but the link is a tracked file whose recorded content is the
    // overlay's path, that path may be the engagement's own name, and the dictionary's terms are
    // suppressed in the file that supplied it. Measured on a fixture repository before this test
    // existed: one occurrence suppressed inside the dictionary that declares it, PASSED, exit 0,
    // over a committed file naming the client.
    const inward = join(guarded, "guard-inward.json");
    symlinkSync(join(directory, "outside-terms.json"), inward);
    if (overlay_inside_scan(guarded, inward, overlay_label) === null) {
      failures.push(
        "an overlay named through a symlink that is itself inside the tree was let through: the link is a " +
          "tracked file holding the overlay's path, and the terms of that overlay are suppressed in it",
      );
    }
    // A file whose name merely opens with two dots is inside the root; `startsWith("..")` said it
    // was outside, which is the same defect at one character's remove.
    const dotted = join(guarded, "..leak-terms.json");
    writeFileSync(dotted, '{"categories":[]}');
    if (overlay_inside_scan(guarded, dotted, overlay_label) === null) {
      failures.push("an overlay whose filename opens with two dots was read as living outside the tree");
    }
    if (overlay_inside_scan(guarded, join(directory, "outside-terms.json"), overlay_label) !== null) {
      failures.push(
        "an overlay genuinely outside the tree being scanned was refused, which forbids the only safe setup",
      );
    }
    const guard_refusal = overlay_inside_scan(guarded, join(spelt, "leak-terms.json"), overlay_label) ?? "";
    if (guard_refusal.includes(unquotable) || guard_refusal.includes(guarded)) {
      failures.push("the overlay-inside-the-scan refusal echoed the overlay's path, and that path is the secret");
    }

    // The staged bytes have to be found under the name the scan will ask for them by, and the two
    // are computed in different functions. They agree today because `main` hands both a root git
    // resolved and paths joined onto it — an invariant nobody had written down, in a file that has
    // now been bitten twice by two spellings of one directory. The root below is deliberately the
    // unresolved spelling while the file list is the resolved one, which is the disagreement, and a
    // key that misses does not fail loudly: the path is reported as "listed in the index and
    // nothing readable is staged under it" and the staged disclosure is never matched at all.
    const staged_repo = join(directory, "staged-fixture");
    mkdirSync(staged_repo, { recursive: true });
    const git_here = (...args: string[]): void => {
      Bun.spawnSync(["git", "-c", "user.email=self-test@example.invalid", "-c", "user.name=self test", ...args], {
        cwd: staged_repo,
        stdout: "pipe",
        stderr: "pipe",
      });
    };
    Bun.spawnSync(["git", "init", "--quiet", "-b", "main", staged_repo], { stdout: "pipe", stderr: "pipe" });
    writeFileSync(join(staged_repo, "kept.md"), "an ordinary line\n");
    git_here("add", "-A");
    git_here("commit", "--no-verify", "--quiet", "-m", "baseline");
    writeFileSync(join(staged_repo, "staged.md"), "the version being committed names zarquilon\n");
    git_here("add", "staged.md");
    // What is on disk after staging is clean, so a scan that reads the working tree finds nothing
    // and a scan that reads the index finds the disclosure. Only one of those is what gets pushed.
    writeFileSync(join(staged_repo, "staged.md"), "the working copy is clean and was never committed\n");
    const staged_resolved = canonical_root(staged_repo);
    const staged_files = list_repository_files(staged_resolved, true);
    const staged_bytes = staged_contents(staged_repo, staged_files);
    const staged_scan = scan_files(staged_files, matchers, staged_repo, new Map(), staged_bytes, null);
    if (!staged_scan.hits.some((hit) => hit.term === "zarquilon" && hit.source === "staged.md")) {
      failures.push(
        "the staged bytes were not found under the name the scan looks them up by, so a disclosure that " +
          "was about to be committed read as a path with nothing staged under it and was never matched",
      );
    }
    if (staged_scan.unreadable.length !== 0) {
      failures.push("a staged path was reported as having nothing staged under it while the index held its bytes");
    }

    // A term carrying a mark with no glyph normalises the way the text it hunts normalises, or it
    // compiles into a matcher that can never fire — and is counted as a term loaded regardless,
    // which is the number the header, the verdict line and --require-overlay all read.
    for (const [mark, spelling] of [
      ["\u200b", "a zero-width space"],
      ["\u00ad", "a soft hyphen"],
      ["\u200e", "a directional mark"],
    ] as Array<[string, string]>) {
      const hidden = build_matchers([
        {
          name: "self_test_fixture",
          why: "fixture",
          terms: [{ term: `zar${mark}quilon`, word_boundary: true, why: "fixture" }],
        },
      ]);
      if (scan_text("probe", "a line naming zarquilon plainly", hidden, null).hits.length !== 1) {
        failures.push(`a term carrying ${spelling} compiled into a matcher that can never fire, and still counted`);
      }
    }
    // And one that still normalises to nothing is refused rather than counted: an overlay of them
    // satisfies --require-overlay, prints a term count and reports PASSED while protecting nothing.
    const dead = join(directory, "overlay-dead-terms.json");
    writeFileSync(
      dead,
      JSON.stringify({
        categories: [{ name: "self_test_fixture", why: "f", terms: [{ term: "\u200b\u00ad", why: "f" }] }],
      }),
    );
    let dead_refused = false;
    try {
      load_dictionaries([dead]);
    } catch {
      dead_refused = true;
    }
    if (!dead_refused) {
      failures.push(
        "an overlay whose every term normalises away loaded, satisfied --require-overlay and would have " +
          "reported PASSED while protecting nothing",
      );
    }

    // The same overlay named twice — `LEAK_TERMS` exported and the same path passed again to
    // `--terms`, which is what following the release runbook verbatim used to do. Terms were
    // deduplicated and said so; exemptions were not, so eleven became twenty-two in silence and
    // `--audit` read one stale entry out twice under one verdict.
    const twice = join(directory, "overlay-twice.json");
    writeFileSync(
      twice,
      JSON.stringify({
        categories: [{ name: "self_test_fixture", why: "fixture", terms: [{ term: "zarquilon", why: "fixture" }] }],
        exemptions: [
          { path: "a.md", category: "self_test_fixture", term: "zarquilon", line: 3, why: "first reason" },
          { path: "b.md", category: "self_test_fixture", term: "zarquilon", line: 0, why: "second reason" },
        ],
      }),
    );
    const doubled = load_dictionaries([twice, twice]);
    if (doubled.exemptions.length !== 2) {
      failures.push(
        `loading one overlay twice produced ${doubled.exemptions.length} exemptions rather than the 2 it ` +
          "declares, so the active count is not a property of the dictionary",
      );
    }
    if (doubled.rejected.length !== 0) {
      failures.push("an exemption repeated verbatim was reported as a conflict rather than as a duplicate");
    }
    if (doubled.dictionaries[1]?.exemptions !== 0 || doubled.dictionaries[1]?.duplicate_exemptions !== 2) {
      failures.push("a second copy of an overlay did not report its exemptions as already recorded");
    }
    if (doubled.dictionaries[1]?.duplicate_terms !== 1) {
      failures.push("the term half of the dedupe stopped reporting, so the fixture proves nothing about the pair");
    }

    // Same occurrence, different stated reason: two judgements, not two copies. The first stands
    // and the second is rejected, which fails the run rather than choosing a reason on its own.
    const disagreeing = join(directory, "overlay-disagrees.json");
    writeFileSync(
      disagreeing,
      JSON.stringify({
        categories: [],
        exemptions: [
          { path: "a.md", category: "self_test_fixture", term: "zarquilon", line: 3, why: "a different reason" },
        ],
      }),
    );
    const conflicting = load_dictionaries([twice, disagreeing]);
    if (conflicting.exemptions.length !== 2 || conflicting.rejected.length !== 1) {
      failures.push("two reasons for one occurrence were merged as a duplicate instead of failing the run");
    }
    if (!conflicting.exemptions.some((entry) => entry.why === "first reason")) {
      failures.push("a conflicting second reason displaced the first entry rather than being refused");
    }

    // And the identity is what decides what an entry suppresses, not the path and term alone: a
    // different line is a different occurrence, and so are two clauses of one line named by two
    // different digests. Both survive the merge as entries of their own.
    const distinct = join(directory, "overlay-distinct.json");
    writeFileSync(
      distinct,
      JSON.stringify({
        categories: [],
        exemptions: [
          { path: "a.md", category: "self_test_fixture", term: "zarquilon", line: 4, why: "first reason" },
          {
            path: "a.md",
            category: "self_test_fixture",
            term: "zarquilon",
            line: 5,
            why: "first reason",
            anchor: anchor_digest("one clause on that line"),
          },
          {
            path: "a.md",
            category: "self_test_fixture",
            term: "zarquilon",
            line: 5,
            why: "first reason",
            anchor: anchor_digest("some other clause on that line"),
          },
        ],
      }),
    );
    const separate = load_dictionaries([twice, distinct]);
    if (separate.exemptions.length !== 5 || separate.rejected.length !== 0) {
      failures.push(
        "entries differing only in the line they name, or in the clause their anchor names, were " +
          "collapsed into one — which is one judgement spent on text nobody read",
      );
    }

    // An empty anchor is not one value among the digests: it means every clause at the line. So an
    // unanchored entry and an anchored one at that line speak about the same occurrence — where
    // the line carries a single clause they resolve to the identical context and suppress the
    // identical hit — and comparing the raw field made them two identities. A repeat was never
    // counted as one, and a contradicting reason over that one occurrence was never refused.
    for (const [why, applied, refused, note] of [
      ["first reason", 2, 0, "was applied a second time rather than counted as the repeat it is"],
      ["a different reason", 2, 1, "was applied alongside the reason it contradicts rather than refused"],
    ] as Array<[string, number, number, string]>) {
      const subsumed = join(directory, `overlay-subsumed-${applied}-${refused}.json`);
      writeFileSync(
        subsumed,
        JSON.stringify({
          categories: [],
          exemptions: [
            {
              path: "a.md",
              category: "self_test_fixture",
              term: "zarquilon",
              line: 3,
              why,
              anchor: anchor_digest("the only clause line 3 carries"),
            },
          ],
        }),
      );
      const merged = load_dictionaries([twice, subsumed]);
      if (merged.exemptions.length !== applied || merged.rejected.length !== refused) {
        failures.push(
          `an entry anchored on a clause of a line an unanchored entry already covers ${note}: an empty ` +
            "anchor covers every clause at its line, so the two are one occurrence",
        );
      }
    }
    if (load_dictionaries([twice, join(directory, "overlay-subsumed-2-0.json")]).dictionaries[1]?.exemptions !== 0) {
      failures.push("an anchored repeat of an unanchored entry was counted as a suppression this overlay contributes");
    }

    // The other three quarters of `exemption_identity`. Only `line` had a case here: dropping
    // `path`, `category` or `term` from the key left this self-test at exit 0 with nothing to say,
    // and each of them does two things at once to a pair of entries differing in that one field.
    // A suppression a person wrote stops being applied, and — where the two state different
    // reasons — the run is failed on a `conflicting_exemption` between entries that never met.
    //
    // So each pair is written twice and the two shapes separate the two faults. With one reason
    // between them a collapse is counted as a copy, and `duplicate_exemptions` says so while
    // `rejected` stays empty; with a reason each a collapse is refused, and `rejected` says so.
    // Dropping `line` raises the same `conflicting_exemption` these do, so the class of the error
    // tells none of them apart. The counts and the entry that went missing do.
    for (const [field, value] of [
      ["path", "b.md"],
      ["category", "self_test_other_category"],
      ["term", "vondrel mikashe"],
    ] as Array<["path" | "category" | "term", string]>) {
      const first = { path: "a.md", category: "self_test_fixture", term: "zarquilon", line: 3, why: "first reason" };
      for (const [shape, why, reasons] of [
        ["copy", "first reason", "one reason between them"],
        ["conflict", "a different reason", "a reason each"],
      ] as Array<[string, string, string]>) {
        const pair_file = join(directory, `overlay-identity-${field}-${shape}.json`);
        writeFileSync(
          pair_file,
          JSON.stringify({ categories: [], exemptions: [first, { ...first, [field]: value, why }] }),
        );
        const apart = load_dictionaries([pair_file]);
        if (apart.exemptions.length !== 2) {
          failures.push(
            `two exemptions differing only in their \`${field}\`, with ${reasons}, loaded as ` +
              `${apart.exemptions.length} rather than 2: one of the two suppressions is not applied, so an ` +
              "occurrence a person cleared is reported and their judgement is spent on the other one",
          );
        }
        if (!apart.exemptions.some((entry) => entry[field] === value)) {
          failures.push(
            `of two exemptions differing only in their \`${field}\`, with ${reasons}, the one naming ` +
              `${value} is the one that was dropped`,
          );
        }
        if (apart.dictionaries[0]?.duplicate_exemptions !== 0) {
          failures.push(
            `two exemptions differing only in their \`${field}\` were counted as one entry and a copy of ` +
              `it: \`${field}\` is not in the identity, so entries covering nothing in common read as the ` +
              "same occurrence stated twice",
          );
        }
        if (apart.rejected.length !== 0) {
          failures.push(
            `two exemptions differing only in their \`${field}\` were read as two reasons for one ` +
              "occurrence and the run was failed on a conflict between entries that cover nothing in " +
              "common — a disagreement that is not in the file",
          );
        }
      }
    }

    // Two overlays merged, which nothing else here and nothing in the suite does. Everything below
    // is a property of the pair and of nothing smaller: the ordinal that names each one, the
    // category the second extends rather than replaces, the term it repeats, and the entry it adds.
    const overlays: string[] = [];
    for (const [name, extra, line] of [
      ["overlay-pair-first.json", "nuvfilax", 3],
      ["overlay-pair-second.json", "cr\u00ebnalix", 4],
    ] as Array<[string, string, number]>) {
      const path = join(directory, name);
      writeFileSync(
        path,
        JSON.stringify({
          categories: [
            {
              name: "self_test_pair",
              why: "fixture",
              terms: [
                { term: "zarquilon", why: "fixture" },
                { term: extra, why: "fixture" },
              ],
            },
          ],
          exemptions: [{ path: "a.md", category: "self_test_pair", term: "zarquilon", line, why: "fixture" }],
        }),
      );
      overlays.push(path);
    }
    const pair_labels = dictionary_labels(overlays);
    if (pair_labels[0] === pair_labels[1]) {
      failures.push(
        `both overlays of a two-overlay run are labelled "${pair_labels[0]}", and that ordinal is the only ` +
          "handle an operator has on a dictionary whose path is never printed — so the header, " +
          "--require-overlay's list and every refusal name a dictionary that cannot be told from the other",
      );
    }
    if (pair_labels[0] !== "overlay 1 of 2 given to --terms" || pair_labels[1] !== "overlay 2 of 2 given to --terms") {
      failures.push(
        `two overlays were labelled "${pair_labels[0]}" and "${pair_labels[1]}", which do not count the ` +
          "--terms arguments in the order they were given",
      );
    }
    const both = load_dictionaries(overlays);
    if (both.dictionaries[0]?.terms !== 2 || both.dictionaries[1]?.terms !== 1) {
      failures.push(
        "two overlays declaring three terms between them, one of which both declare, loaded " +
          `${both.dictionaries[0]?.terms} and ${both.dictionaries[1]?.terms}: each row's count is what ` +
          "says how much of the vocabulary came from that argument",
      );
    }
    if (both.dictionaries[1]?.merged.join() !== "self_test_pair" || both.dictionaries[1]?.duplicate_terms !== 1) {
      failures.push(
        "a second overlay declaring a category the first already declared did not record that it extended " +
          "that category and repeated one of its terms, which is a merge reading as a replacement",
      );
    }
    if (both.categories.length !== 1) {
      failures.push(
        `two overlays declaring one category between them pooled it into ${both.categories.length}, so the ` +
          "merge these labels name is not the merge being measured",
      );
    }
    if (both.exemptions.length !== 2 || both.rejected.length !== 0) {
      failures.push(
        "two overlays each exempting a different line of one file did not contribute an entry each, so a " +
          "second overlay's suppressions depend on what the first one happened to say",
      );
    }
    const pair_header = streams(() => {
      report_dictionaries(both.dictionaries, true);
    });
    for (const wanted of ["overlay 1 of 2", "overlay 2 of 2", "extended rather than replaced"]) {
      const times = pair_header.out.split(wanted).length - 1;
      if (times !== 1) {
        failures.push(`a quiet header over two merged overlays printed "${wanted}" ${times} times rather than once`);
      }
    }
    const nothing_declared =
      overlay_shortfall(
        both.dictionaries.map((entry) => ({ ...entry, terms: 0 })),
        [],
      ) ?? "";
    if (nothing_declared.split(pair_labels[1] as string).length - 1 !== 1) {
      failures.push(
        "--require-overlay's list of the overlays that declared nothing named one of them twice and the " +
          "other not at all, so an operator cannot tell which --terms argument to look at",
      );
    }

    // The clearance finds a blob that no ref's tree still points at.
    const nothing_covered: Covered = { blobs: new Set(), names: new Set() };
    const repository = plant_history(directory);
    const history = scan_history(repository, null, matchers, nothing_covered);
    if (!history.hits.some((hit) => hit.term === "zarquilon" && hit.path === "was-here.txt")) {
      failures.push("the history scan did not find a deleted file's blob, which is the whole clearance");
    }
    if (!history.hits.some((hit) => / \(added in [0-9a-f]{12}\)$/.test(hit.source))) {
      failures.push("a history hit did not name the commit that added it");
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

    // Attribution. One path, three versions, and a fourth commit that moves the path away.
    // `--find-object` names every commit whose diff touches a blob — the one that added it and
    // the one that replaced or removed it — so taking git's first answer labelled every version
    // with the commit holding the *next* one, and labelled the last version with a commit that
    // does not hold the path at all. Both spellings are checked: the range the walk was given,
    // where that fourth commit is a descendant and outside the range entirely, and the whole
    // graph, where it is in range and still wrong.
    const planted_versions = plant_versions(directory);
    const third = planted_versions.versions[2] as Version;
    for (const [range, spelling] of [
      [third.commit, "the scanned range"],
      [null, "every ref"],
    ] as Array<[string | null, string]>) {
      const walked = scan_history(planted_versions.repository, range, matchers, nothing_covered);
      for (const [index, version] of planted_versions.versions.entries()) {
        const wanted = `history:${planted_versions.path} (added in ${version.commit.slice(0, 12)})`;
        const found = walked.hits.find((hit) => hit.path === planted_versions.path && hit.line === index + 1);
        if (found === undefined) {
          failures.push(`over ${spelling}, version ${index + 1} of a three-version path was not found at all`);
        } else if (found.source !== wanted) {
          failures.push(
            `over ${spelling}, version ${index + 1} of a three-version path is labelled "${found.source}" and ` +
              `not "${wanted}": a blob is being attributed to a commit that does not hold it`,
          );
        }
      }
    }
    // The commit that moved the path away is a descendant of the range the walk was given, so a
    // label naming it points outside the history the run cleared — the reader is sent to rewrite
    // at a commit the run never looked at.
    const beyond = scan_history(planted_versions.repository, third.commit, matchers, nothing_covered);
    const moved_away = git_text(["rev-parse", "HEAD"], planted_versions.repository);
    const descendant = moved_away.ok ? moved_away.stdout.trim().slice(0, 12) : "";
    if (descendant !== "" && beyond.hits.some((hit) => hit.source.includes(descendant))) {
      failures.push(
        "a history hit scanned over a range was labelled with a commit outside that range, and a descendant " +
          "of its tip at that",
      );
    }
    // One blob, two homes. A path committed, deleted and committed again byte for byte was added
    // twice, and both additions are points a rewrite has to cut at. Naming the later one alone —
    // which is what taking git's first answer did — sends somebody to cut once and stop.
    const several = `history:${planted_versions.restored} (added in ${planted_versions.homes
      .map((sha) => sha.slice(0, 12))
      .join(", ")})`;
    const two_homes = beyond.hits.find((hit) => hit.path === planted_versions.restored);
    if (two_homes === undefined) {
      failures.push("a blob added, deleted and added back was not found in the history at all");
    } else if (two_homes.source !== several) {
      failures.push(
        `a blob with two homes is labelled "${two_homes.source}" and not "${several}": one of the commits it ` +
          "has to be cut out of is not named",
      );
    }

    // Merges. `git log --find-object` does not diff a merge unless it is told to, so a merge whose
    // resolved content matched no parent — every hand-edited conflict resolution there is — was
    // never a candidate. The one candidate git did return was the later commit whose diff takes
    // the blob *away*, the tree check correctly threw it out, and the fallback printed it anyway:
    // `added in` naming the one commit in the graph that never held the secret, and an operator
    // cutting there leaves it behind. The last of the four is the parent comparison's own case,
    // where the merge is a candidate and the commit that wrote the bytes is not it.
    const planted_merges = plant_merges(directory);
    const merged = scan_history(planted_merges.repository, null, matchers, nothing_covered);
    for (const [shape, want, note] of [
      [
        planted_merges.resolved,
        "added in",
        "a hand-resolved conflict that a later commit replaced is not named as the commit that added it, so " +
          "the label points at a tree the secret was never in",
      ],
      [
        planted_merges.kept,
        "added in",
        "a hand-resolved conflict nothing ever removed is not named as the commit that added it, and with no " +
          "candidate at all the label claimed no commit in the range adds it",
      ],
      [
        planted_merges.octopus,
        "added in",
        "a three-parent resolution is not named exactly once as the commit that added it",
      ],
      [
        planted_merges.inherited,
        "added in",
        "a merge that took its second parent's file whole was named over the branch commit that wrote those " +
          "bytes, so the parent comparison is not narrowing the candidates",
      ],
    ] as Array<[{ path: string; commit: string }, string, string]>) {
      const wanted = `history:${shape.path} (${want} ${shape.commit.slice(0, 12)})`;
      const found = merged.hits.find((hit) => hit.path === shape.path);
      if (found === undefined) {
        failures.push(`a term introduced at ${shape.path} by a merge was not found in the history at all`);
      } else if (found.source !== wanted) {
        failures.push(`${note} — it reads "${found.source}" and not "${wanted}"`);
      }
    }

    // What `resolve_specs` may read as an object id, which decides which trees are compared
    // against which. `git cat-file --batch-check` answers `<id> <type> <size>` and echoes a
    // request it could not resolve as `<request> missing`, so an unresolvable path holding one
    // space answers in three fields like a resolved one, and an unresolvable bare id answers in
    // two fields whose first *is* a well-formed id. Read either as an answer and a commit is
    // compared against an object it does not have.
    const spec_head = git_text(["rev-parse", "HEAD"], planted_merges.repository).stdout.trim();
    const answers = resolve_specs(planted_merges.repository, [
      `${spec_head}:${planted_merges.spaced}`,
      `${spec_head}:${planted_merges.spaced_absent}`,
      planted_merges.absent,
      `${spec_head}:no-such-file.md`,
    ]);
    const spaced_blob = git_text(["rev-parse", `HEAD:${planted_merges.spaced}`], planted_merges.repository);
    if (answers[0] !== spaced_blob.stdout.trim()) {
      failures.push("a path holding a space did not resolve to its own blob, so the fixture proves nothing");
    }
    if (answers[1] !== null) {
      failures.push(
        `an unresolvable path holding a space was read as the object id "${answers[1]}": the answer has three ` +
          "fields like a resolved one, and its first field is the head of the request rather than any object",
      );
    }
    if (answers[2] !== null) {
      failures.push(
        `an object id naming nothing was read back as "${answers[2]}": \`<id> missing\` is two fields, and the ` +
          "first of them is a well-formed id, so only the field count says the object is not there",
      );
    }
    if (answers[3] !== null) {
      failures.push(`an unresolvable path was read as the object id "${answers[3]}"`);
    }

    // A repository that names its objects with SHA-256, carrying enough history to reach every
    // reader whose answer depends on how wide an object id is.
    //
    // The terminator `--format=%B%n%H` writes is sixty-four hex here, a forty-hex terminator
    // matches no line of it, and every commit message in such a history went unread under a
    // printed PASSED. That is the repair this fixture was first built for, and it was the only
    // reader it reached. Six others hand back an object id of their own, and all six are correct
    // and were reachable by nothing, because a single-commit repository holding one file is too
    // small to ask them anything: it supersedes no blob, so no history hit is ever attributed and
    // neither `introducing_commits` nor `resolve_specs` runs at this width at all; nothing is
    // inherited, so no candidate is ever compared against a parent; its root tree holds one entry,
    // which any stride parses; and its index is never asked for a name, nor its bytes hashed,
    // because the scan below is handed the object graph directly.
    //
    // So the fixture supersedes one blob, inherits another, hides a name behind a shared one, and
    // has its own digest and its own index read back. Seven checks follow: two on the terminator,
    // one on the pair of object-id parses the attribution runs through, one on the parent
    // comparison those parses feed, one on the tree stride, one on the digest and one on the
    // index. Between them they also put every reader that must take *no* width — the batch-check
    // descriptions, the batch reads, the `rev-list --objects` split — in front of sixty-four-hex
    // ids, so a fixed offset written into any of those dies here too.
    const wide = join(directory, "sha256-fixture");
    mkdirSync(wide, { recursive: true });
    Bun.spawnSync(["git", "init", "--quiet", "--object-format=sha256", "-b", "main", wide], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const wide_commit = (message: string): string => {
      Bun.spawnSync(["git", "add", "-A"], { cwd: wide, stdout: "pipe", stderr: "pipe" });
      Bun.spawnSync(
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
        { cwd: wide, stdout: "pipe", stderr: "pipe" },
      );
      return git_text(["rev-parse", "HEAD"], wide).stdout.trim();
    };
    // Three ordinary lines above the shared one, because the id git gives these exact bytes is
    // what decides whether the hidden name below can prove anything at all: see the precondition
    // a few lines down.
    const wide_shared = `${"an ordinary line\n".repeat(3)}a line with nothing in it at all\n`;
    writeFileSync(join(wide, "ordinary.txt"), wide_shared);
    // The same bytes under a second name. `rev-list --objects` prints a blob once, under whichever
    // name it walked first, so this second name is carried by nothing but the tree object — and it
    // sorts directly behind `ordinary.txt` there, which is the entry whose id a narrow stride
    // walks into the middle of.
    writeFileSync(join(wide, "shared-name-zarquilon.txt"), wide_shared);
    writeFileSync(join(wide, "superseded.md"), "the first version carries zarquilon\n");
    // A blob the second commit inherits rather than writes, and then files under a second name of
    // its own. `--find-object` lists that second commit, because its diff does introduce the
    // object — somewhere else — while its tree still holds it here and so does its parent's. That
    // is the one shape in which the parent ids on the `%H %P` line decide anything: a candidate
    // whose parent is not seen holding the blob is reported as having added it.
    //
    // Note what is and is not at risk there. The ids become `<parent>:<path>` requests, and git
    // resolves any unambiguous abbreviation, so *truncating* a parent to forty hex changes nothing
    // — measured: `cat-file --batch-check` answers a forty-character prefix of a sixty-four-hex
    // commit id with the blob. What breaks is *rejecting* one for being too wide, which is the
    // shape every repair in this file has taken, and a rejected parent reads as a parent that did
    // not hold the blob. The SHA-1 fixtures cannot see it: at their width nothing is rejected.
    const wide_inherited = "a version no commit ever replaces, holding zarquilon\n";
    writeFileSync(join(wide, "inherited.md"), wide_inherited);
    const wide_added = wide_commit("a commit message carrying zarquilon");
    writeFileSync(join(wide, "superseded.md"), "the replacement line says nothing at all\n");
    // `zz-` so it sorts behind `inherited.md`, which keeps the walked path — the one the label is
    // built for, and the only one whose parent still holds the blob — the first of the two.
    writeFileSync(join(wide, "zz-copy-of-inherited.md"), wide_inherited);
    const wide_replaced = wide_commit("a second commit message with nothing in it");
    const wide_shared_id = git_text(["rev-parse", "HEAD:ordinary.txt"], wide).stdout.trim();
    if (object_format(wide) !== "sha256") {
      failures.push("this git could not make a sha256 repository, so the wide-hash fixture proves nothing");
    } else if (wide_added === "" || wide_replaced === "" || wide_added === wide_replaced) {
      failures.push("the sha256 fixture did not record two commits, so its superseded blob proves nothing");
    } else if (git_text(["rev-list", "--objects", "--all"], wide).stdout.includes("shared-name-zarquilon")) {
      failures.push(
        "`rev-list --objects` named the sha256 fixture's shared path itself, so finding that name no longer " +
          "proves the walk read it out of a tree object",
      );
    } else if (!Buffer.from(wide_shared_id, "hex").subarray(20).includes(0x20)) {
      // A tree walk that strides the narrow width lands twelve bytes short, inside the id it was
      // supposed to step over, and then looks for the space that opens the next entry's mode — so
      // it finds its place again, and loses nothing, unless one of those twelve bytes is itself a
      // space. Which id this is depends on the bytes written above and on nothing else, so the
      // content was chosen until git named it one that carries one.
      failures.push(
        "the sha256 fixture's shared blob is named by an id holding no space byte past the narrow width, so a " +
          "walk striding that width would recover the hidden name anyway and the check below would pass " +
          "against a stride that is wrong — the file contents above decide this, and these no longer do",
      );
    } else {
      const widely = scan_history(wide, null, matchers, nothing_covered);
      if (widely.commits !== 2) {
        failures.push(
          `${widely.commits} commit messages were read out of a sha256 repository holding 2: the terminator git ` +
            "writes is an id in the repository's own hash, and a narrower one matches no line of the log",
        );
      }
      if (!widely.hits.some((hit) => hit.term === "zarquilon" && hit.source.startsWith("commit "))) {
        failures.push("a term in a sha256 repository's commit message was not found, and the run would say PASSED");
      }
      // The commits `--find-object` lists and the trees `cat-file --batch-check` resolves are both
      // named in this repository's hash. A reader that only knows the narrow one lists no
      // candidate, or resolves no tree entry to compare against, and either way the attribution
      // collapses to "no commit in the scanned range adds it" — an operator told there is nowhere
      // to cut, about the one blob a rewrite exists to remove.
      const wide_wanted = `history:superseded.md (added in ${wide_added.slice(0, 12)})`;
      const wide_hit = widely.hits.find((hit) => hit.path === "superseded.md");
      if (wide_hit === undefined) {
        failures.push("a superseded blob in a sha256 repository was not found in the history at all");
      } else if (wide_hit.source !== wide_wanted) {
        failures.push(
          `a superseded blob in a sha256 repository reads "${wide_hit.source}" and not "${wide_wanted}": the ` +
            "commit that added it, and the trees compared to prove it added it, are both named sixty-four hex " +
            "wide here",
        );
      }
      // The blob the second commit inherited. Both commits are candidates and both trees hold it
      // here, so the whole answer turns on comparing each candidate against its parents — which is
      // the only thing the parent ids on the log line are ever used for.
      const inherited_wanted = `history:inherited.md (added in ${wide_added.slice(0, 12)})`;
      const inherited_hit = widely.hits.find((hit) => hit.path === "inherited.md");
      if (inherited_hit === undefined) {
        failures.push("a blob carried unchanged through a sha256 repository's second commit was not found at all");
      } else if (inherited_hit.source !== inherited_wanted) {
        failures.push(
          `a blob a sha256 repository's second commit inherited reads "${inherited_hit.source}" and not ` +
            `"${inherited_wanted}": a parent this walk did not keep reads as a parent that did not hold the ` +
            "blob, and an operator is sent to cut at a commit that only carried it",
        );
      }
      if (!widely.hits.some((hit) => hit.path === "shared-name-zarquilon.txt")) {
        failures.push(
          "a term in a sha256 repository's path that only a tree object carries was not found: a tree entry " +
            "ends in a raw object id as wide as the repository's hash, and a walk striding the narrow width " +
            "reads the entry behind it out of the middle of that id",
        );
      }
      // The digest that decides what a clearance may skip is taken in the repository's own hash
      // too. Computed in the narrow one it names nothing git ever wrote, so no tracked blob is
      // ever recognised as read: every one of them is scanned a second time under a `history:`
      // label, and the report's count of blobs the working-tree pass did not reproduce is the
      // whole index.
      const wide_digest = blob_id("sha256", new TextEncoder().encode(wide_shared));
      if (wide_digest !== wide_shared_id) {
        failures.push(
          `a sha256 repository's blob is hashed to ${wide_digest.slice(0, 12)} where git names the same bytes ` +
            `${wide_shared_id.slice(0, 12)}, so a clearance there would recognise nothing it had read`,
        );
      }
      // And the other half of that comparison: the names the index lists, which is what the report
      // counts a run's own digests against. Nothing is skipped on the strength of this set, so a
      // wrong reading of it costs a number rather than a scan — but it is a number an operator
      // reads as "this tree is dirty", and at this width nothing else in the self-test asks the
      // index for a name at all.
      if (!index_blobs(wide).has(wide_shared_id)) {
        failures.push(
          `the index of a sha256 repository does not list ${wide_shared_id.slice(0, 12)}, the name git gives a ` +
            "blob it holds, so the count of committed blobs a run did not reproduce is taken against names " +
            "that are not the repository's",
        );
      }
    }

    // A range that begins after the blob arrived. Nothing in it adds the blob, so nothing in it
    // may be labelled as adding the blob — and the answer may not be the commit whose diff took it
    // away, which is what the old fallback printed: the oldest commit git listed, chosen on the
    // reasoning that an object has to enter the graph before a diff can take it out again. It
    // does, but not necessarily inside the range, and the walk has already resolved that this
    // commit's tree does not hold the blob before throwing the answer away.
    const planted_carried = plant_carried(directory);
    const arrival = git_text(
      ["rev-parse", `${planted_carried.holder}:${planted_carried.path}`],
      planted_carried.repository,
    );
    const carried = introducing_commits(
      planted_carried.repository,
      planted_carried.range,
      arrival.stdout.trim(),
      planted_carried.path,
    );
    if (carried.kind !== "held" || carried.commits.join() !== planted_carried.holder) {
      failures.push(
        `a blob no commit in the range adds is attributed as ${carried.kind} to ` +
          `${carried.commits.map((sha) => sha.slice(0, 12)).join(", ") || "nothing"}, and not held by ` +
          `${planted_carried.holder.slice(0, 12)}: the only other answer git listed is ` +
          `${planted_carried.removal.slice(0, 12)}, whose diff takes the blob away and whose tree does not ` +
          "hold it, so naming it sends an operator to cut at a commit the secret was never in",
      );
    }
    if (ORIGIN_CLAUSE[carried.kind]("abc123def456").startsWith("added in")) {
      failures.push("a blob nothing in the range adds is labelled as added, which is the claim it cannot make");
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
    // The third way a tracked file goes unread, and the one that used to escape as an exception
    // rather than a gap: the file is there, `lstat` answers, and `open` refuses. It reached
    // `throw` and took the run with it — exit 2, the absolute path on stderr, no verdict about
    // the files that were read. Skipped where mode 000 does not stop this user, since root reads
    // it regardless and the case would assert nothing.
    const barred = join(repository, "barred.txt");
    writeFileSync(barred, "zarquilon lives here");
    run_git(["add", "--", "barred.txt"], repository);
    chmodSync(barred, 0o000);
    let barred_holds = true;
    try {
      readFileSync(barred);
      barred_holds = false;
    } catch {
      barred_holds = true;
    }
    if (barred_holds) {
      const with_barred = scan_files(
        list_repository_files(repository, false),
        matchers,
        repository,
        new Map(),
        null,
        object_hash,
      );
      if (!with_barred.unreadable.some((entry) => entry.startsWith("barred.txt "))) {
        failures.push(
          "a tracked file whose mode refuses the read was not named as unread, so the run either aborted on it " +
            "or dropped it without saying so",
        );
      }
      if (with_barred.hits.some((hit) => hit.path === "barred.txt")) {
        failures.push("a file that could not be opened reported a hit, so something read bytes nothing could read");
      }
    } else {
      skipped.push(
        "a tracked file whose mode refuses the read: this user opened a mode-000 file anyway, which is what " +
          "root does, so the check that a refused read is named as a gap rather than aborting the run could " +
          "not be exercised here. Run the self-test as a non-root user to cover it.",
      );
    }
    chmodSync(barred, 0o644);
    rmSync(barred);
    run_git(["add", "-A"], repository);
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
        `buried in the boundary control, ${result.scanned} files and ${result.nodes.length} paths and parent ` +
        "directories " +
        `scanned, ${result.salvaged.length} read only for the runs of text in them, ${result.binary.length} ` +
        `unread, ${tracked.blobs.size} tracked ${tracked.blobs.size === 1 ? "blob" : "blobs"} proved read and ` +
        `${tracked.unreadable.length} named unreadable in the fixture repository, ${history.blobs} historical ` +
        `blobs, ${history.refs} ref ${history.refs === 1 ? "name" : "names"}, ${history.tags} tag ` +
        `${history.tags === 1 ? "message" : "messages"} and ${history.unread.length} named ` +
        `${history.unread.length === 1 ? "skip" : "skips"} across ${history.commits} commits, ` +
        `phrase separators cleared in ${elapsed}ms.`,
    );
    if (failures.length > 0) {
      // `all` is the set the fixtures above were planted from, and it is what decides whether the
      // checks may be printed; the rule, with the argument for it, lives in `self_test_failures`.
      for (const line of self_test_failures(failures, all)) {
        console.log(line);
      }
      console.log("Self-test FAILED — the checker does not do what it claims.");
      return 1;
    }
    for (const line of skipped) {
      console.log(`  SKIPPED — ${line}`);
    }
    const headline =
      skipped.length === 0
        ? "Self-test PASSED"
        : `Self-test PASSED WITH ${skipped.length} ${skipped.length === 1 ? "CHECK" : "CHECKS"} SKIPPED`;
    console.log(
      `${headline} — every term is found where it was planted; a decomposed, wrapped, zero-width-broken, ` +
        "percent-encoded, fullwidth, mathematical, ligatured, Cyrillic or Greek spelling is caught; a term in a " +
        "filename, a directory name, a phrase split across a directory separator, a symlink target, a UTF-16 " +
        "file, the readable runs of a file with one stray NUL, a short plaintext run behind NULs, a phrase " +
        "either side of one damaged byte, a branch name, a lightweight tag name, an annotated tag's message, " +
        "a deleted file's historical blob and a historical path whose blob another path already supplied are " +
        "all caught; a historical blob is labelled with the commit that added it at that path and not with " +
        "the one that replaced it, out of the range the walk was given rather than from past its tip, and " +
        "with every commit that added it where a blob was added more than once, and with the merge that " +
        "resolved a conflict by hand — two parents or three, replaced later or never — rather than with the " +
        "commit that replaced it or with nothing at all; a blob no commit in the range adds is not labelled " +
        "as added by the oldest commit listed, which is the one whose diff took it away; an unresolvable " +
        "object request is read as no object rather than as the head of its own request; a term in the " +
        "commit message of a repository that names its objects with sha256 is read, where a forty-hex " +
        "terminator read no message in it at all and printed PASSED, and in that same repository a " +
        "superseded blob is still attributed to the commit that added it, a blob the second commit inherited " +
        "is not attributed to that second commit, a path no `rev-list --objects` line carries is still read " +
        "out of the tree object that holds it, and that repository's own bytes are still hashed to the name " +
        "git gives them and found under that name in its index, all five of which take an object id at the " +
        "width this repository names them; " +
        "the clearance skips only blobs whose bytes this run hashed as it read them, so the " +
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
        "at all is named and changes the verdict; an empty or malformed overlay fails --require-overlay; one " +
        "overlay loaded twice contributes its exemptions once and says so, while two reasons for the same " +
        "occurrence fail the run rather than merging and two occurrences stay two entries, while an entry " +
        "anchored on a clause an unanchored entry at that line already covers is one of them and not a " +
        "second, and while two entries differing only in the path, the category or the term they name stay " +
        "two entries — neither collapsed as a copy of the other nor refused over a disagreement neither " +
        "states; a term carrying a zero-width space, a soft hyphen or a directional mark still matches the " +
        "text those marks are stripped out of, and one that normalises away to nothing is refused rather " +
        "than counted as a term this run loaded; an overlay that cannot be opened is reported as an open " +
        "failure and not as a syntax one, and one that is not there at all is reported as not being there " +
        "rather than as a withheld runtime error; every refusal the dictionary path can raise names a " +
        "coordinate — a category and term index, or a line and column — and quotes neither the entry, nor " +
        "the token the engine choked on, nor the path the file was read from, and an error raised anywhere " +
        "else while the dictionary is open is withheld outright; the header prints an overlay's counts and " +
        "never its path, at either volume, so an overlay under a directory named after the engagement " +
        "publishes nothing, and two merged overlays are told apart by the position of their own --terms " +
        "argument — in the header, in --require-overlay's list and in every refusal — with the second " +
        "pooling its category into the first rather than replacing it; an overlay inside the tree about " +
        "to be scanned is refused however the two are spelt, through a symlink in either direction — one " +
        "standing outside the tree and naming a dictionary in it, whether or not that target exists yet, " +
        "and one standing inside the tree and naming a dictionary outside — or with a filename opening on " +
        "two dots, and one genuinely outside it is " +
        "not; a quiet report and a quiet header keep their verdict and their counts and put no term, " +
        "no category name and no reason on either stream; a failing self-test prints the checks that " +
        "failed when the only vocabulary loaded is the one invented in this file, and prints their count " +
        "alone when an overlay is merged; and a hit exits 1.",
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
 *
 * A directory this user may not list is collected into `unlistable` instead of thrown. One of
 * them anywhere under the target used to abort the whole run at exit 2, which suppressed the
 * verdict for every file that had already been read — the run said nothing at all about a tree it
 * had mostly finished scanning. It is a gap like any other, and the report has a place to name it.
 */
function walk_path(target: string, unlistable: string[]): string[] {
  let stats: Stats;
  try {
    stats = lstatSync(target);
  } catch (failure) {
    const code = (failure as NodeJS.ErrnoException).code;
    if (code !== "EACCES" && code !== "EPERM") {
      throw failure;
    }
    unlistable.push(target);
    return [];
  }
  if (!stats.isDirectory()) {
    return [target];
  }
  let entries: Dirent[];
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch (failure) {
    const code = (failure as NodeJS.ErrnoException).code;
    if (code !== "EACCES" && code !== "EPERM") {
      throw failure;
    }
    unlistable.push(target);
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES[entry.name] === undefined) {
        found.push(...walk_path(join(target, entry.name), unlistable));
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
 *
 * The keys are the labels `scan_files` will look these bytes up by, computed the same way and not
 * merely in a way that happens to agree. They agree today because `root` is canonical and every
 * path was joined onto it, but that is an invariant nobody states and this file has already been
 * bitten twice by two spellings of one directory; see `canonical`. A key that misses reads as a
 * path listed in the index with nothing staged under it, which is a sentence about a stale entry
 * or a submodule and would be entirely untrue.
 */
function staged_contents(root: string, files: string[]): Map<string, Uint8Array> {
  const base = canonical_root(root);
  const relatives = files.map((path) => {
    const absolute = canonical(path);
    return under(base, absolute)?.split(sep).join("/") ?? absolute;
  });
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
      "Usage: bun .github/leak-check.ts [options]",
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
    // `canonical` and not `resolve`: these paths are compared against a repository root that git
    // resolved, and a spelling that disagrees defeats `overlay_inside_scan`. `labels` is all any
    // message may say about them; see `dictionary_labels`.
    const paths = options.terms.map((path) => canonical(path));
    const labels = dictionary_labels(paths);
    // Everything inside this fence has the dictionary open, so an error escaping it carries the
    // dictionary unless this file wrote the message. The outer catch prints to stderr, which
    // `--quiet` does not reach and must not — an operator whose overlay is broken has to be told
    // — so what crosses the fence is a `Refusal` or nothing. See `Refusal` and `withheld`.
    let loaded: Loaded;
    let matchers: Matcher[];
    try {
      loaded = load_dictionaries(paths);
      matchers = build_matchers(loaded.categories);
    } catch (failure) {
      throw failure instanceof Refusal ? failure : withheld(failure, labels);
    }
    const { categories, exemptions, rejected, dictionaries, quoted } = loaded;
    report_dictionaries(dictionaries, options.quiet);

    if (options.require_overlay) {
      const shortfall = overlay_shortfall(dictionaries, matchers);
      if (shortfall !== null) {
        throw new Refusal(shortfall);
      }
    }

    if (options.mode === "self_test") {
      return self_test(categories);
    }

    if (options.mode === "audit") {
      return audit_allowlist(gated_root(), exemptions, rejected, matchers, options.quiet);
    }

    if (options.message !== null) {
      const root = gated_root();
      let raw: string;
      try {
        raw = readFileSync(options.message, "utf8");
      } catch (failure) {
        const code = (failure as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR" && code !== "EACCES" && code !== "EPERM") {
          throw failure;
        }
        // A `Refusal`, for the reason spelled out above `Dictionary not found`: the fence turns a
        // plain error into `withheld`, which would tell the operator their message was suppressed
        // because a runtime error quotes what it choked on. Nothing quoted anything here — the
        // file was simply not readable, and saying so names only a path.
        throw new Refusal(
          `Commit message not readable: ${shorten(canonical(options.message))}.\n` +
            "  Nothing was read, so this run has no verdict to give about the message. Check the path given " +
            "to --message exists and is readable from here.",
        );
      }
      const text = strip_commit_message(raw, comment_character(root));
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
    // Directories the walk was refused. Collected rather than thrown for the reason given above
    // `walk_path`, and named in the report so a partial scan cannot read as a whole one.
    const unlistable: string[] = [];
    const scopes: string[] = [];

    if (options.path !== null) {
      const named = canonical(options.path);
      let stats: Stats;
      try {
        // Follows the link deliberately: the question is what the operator pointed at, and a
        // symlink to a directory is a directory to them.
        stats = statSync(named);
      } catch (failure) {
        const code = (failure as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR" && code !== "EACCES" && code !== "EPERM") {
          throw failure;
        }
        throw new Refusal(
          `--path names ${shorten(named)}, which this run cannot open: ` +
            (code === "EACCES" || code === "EPERM"
              ? "its mode, or that of a directory on the way to it, refuses this user."
              : "there is nothing there.") +
            "\n  Nothing was read, so this run has no verdict to give about it.",
        );
      }
      // A root is a place, not a name. This `stat` follows a symlink and the walk's `lstat` does
      // not, so the two disagreed about the same argument: `stat` adopted the link's target as the
      // root, the walk returned the link itself as a single leaf, and `--path` at a symlinked
      // directory printed PASSED over a directory it never opened — while the identical directory
      // named directly came back FAILED. Resolving the argument when it points at a directory is
      // what makes them agree. A symlink the walk *finds* still keeps its own name and is read as
      // content in its own right; see `canonical`.
      const target = stats.isDirectory() ? canonical_root(named) : named;
      const base = stats.isDirectory() ? target : dirname(target);
      // Report paths relative to the repository, not to the scanned subtree, so an exemption
      // written once matches whether the run covered one directory or every tracked file.
      const found = git_text(["rev-parse", "--show-toplevel"], base);
      root = found.ok ? canonical_root(found.stdout.trim()) : base;
      files = walk_path(target, unlistable);
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
      root = gated_root();
      files = list_repository_files(root, options.mode === "staged");
    }

    for (const [index, dictionary] of paths.entries()) {
      const refusal = overlay_inside_scan(root, dictionary, labels[index] as string);
      if (refusal !== null) {
        throw new Refusal(refusal);
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
    // A directory nobody could list is a gap in exactly the sense the report already means by one:
    // nothing under it went through the matcher. It is counted beside the verdict as well as named
    // here, because a run that skipped a whole subtree must not read as one that covered it.
    const scan_root = canonical_root(root);
    const refused = unlistable.map(
      (path) =>
        `${under(scan_root, path) ?? shorten(path)} — a directory this user may not list, so nothing under it ` +
        "was read",
    );
    const unread = [
      ...result.binary.map(
        (path) => `${path} — not text in any encoding this checker knows, and holding no readable run`,
      ),
      ...result.unreadable,
      ...refused,
    ];
    const partial = [...result.salvaged];
    // Coverage is part of the verdict, and a deliberate suppression is not the same fact as a file
    // that could not be read: one is a measured blind spot, the other is a gap nobody chose.
    const coverage =
      `${result.nodes.length} paths and parent directories matched by name, ` +
      `${result.binary.length} not text and named above, ` +
      `${result.salvaged.length} not text but read for the runs that are, and named above, ` +
      `${result.unreadable.length + refused.length} absent, unreadable or not a file, and named above, ` +
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
          `objects, ${scanned.names} historical paths and parent directories, ${scanned.refs} ref ` +
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
