# Repository scripts

## `leak-check.ts`

This repository is public. Some of the work that produced it was not. `leak-check.ts` scans for vocabulary carried over from private engagements and fails the run if any of it appears — in a tracked file, in a file or directory name, in a staged change, in a commit message, or in any version of any file that is still reachable from any ref.

### The vocabulary is not in this repository

`leak-terms.json`, next to the script, documents the dictionary schema and declares no terms at all. That is not an oversight and it is not a stub waiting to be filled in.

An earlier version of this file kept the "generic" half of a dictionary in public and moved only names and figures to a private overlay. The half that stayed was a curated list of one domain's words, and a curated list of a domain's words identifies that domain precisely — which is what a list of that shape is for. Nobody needs the client's name once they have the vocabulary. The list was the disclosure.

So the whole dictionary is private. This repository ships the mechanism; each project keeps its own terms and merges them at run time:

```sh
bun scripts/leak-check.ts --terms ~/private-work/leak-terms.json     # repeatable
LEAK_TERMS=~/a.json:~/b.json bun scripts/leak-check.ts               # colon-separated
```

The empty file is kept rather than deleted, and the tool still loads it, for two reasons. It documents the schema — every field, every rule, and why each one exists — where somebody writing an overlay will look for it, and a schema is not a disclosure. And it makes the emptiness a positive statement: `0 terms in 0 categories` on the header of every run says the public repository carries no vocabulary, where a missing file would only say the tool could not find one.

An overlay uses the schema documented in that file. Categories with the same name pool their terms and a term already defined keeps its first definition, and the run names both so a merge can never be read as a replacement. An overlay that is itself inside this repository is refused outright: a dictionary's own terms are suppressed inside it, so a committed overlay would be the one file its vocabulary could never be reported in.

Short or ambiguous terms match as whole words only, so a three-letter term does not fire on every hash in the repository and a four-letter one does not fire on ordinary English that happens to contain it. Longer, unambiguous terms match anywhere, including glued inside a slug, an identifier or a URL. Multi-word terms tolerate spaces, underscores or hyphens between the words, and one line break. Each term's entry records which rule it uses and why.

### A run without vocabulary is not a pass

Because the shipped dictionary matches nothing, a run with no overlay checks no name and no figure, prints `PASSED` and exits 0 — the same exit code as a complete run. The header says an overlay is missing, which protects a human reading the output, but a hook and a CI step read only the exit code.

`--require-overlay` closes that. It fails, with exit code 2, any run that loaded **no terms** — 2 rather than 1, because the gate could not be run as asked rather than having found something. **Pass it everywhere the checker is invoked as a gate**, which is what the workflow and both hooks below do.

It tests loaded vocabulary rather than a merged file, and the difference is the whole point. An overlay of `{}`, of `[]`, of `{"categories": []}`, or with a category whose term list is empty, all merge perfectly well and all declare nothing: they print `0 terms`, they silence the missing-overlay advisory, and they exit 0 — which is precisely the state the flag exists to refuse, moved up one level. In CI the only thing the workflow can check about the secret is that it is non-empty, so a secret rotated to `{}` would otherwise sail through. An overlay that exists but does not parse, or that parses into something that is not a dictionary, fails the run outright rather than loading as an absent one.

Every run also prints which dictionaries it loaded and how many terms each supplied, and repeats the count on the final `PASSED`/`FAILED` line, because a half-loaded dictionary is the failure mode nobody notices.

### Exemptions travel with the dictionary

Policy prose and disclosure look identical to a substring match. A skill that documents which categories an ad network prohibits has to name them, and a localised product name or an ordinary English word will sometimes collide with a banned term. Those cases are named in the overlay's `exemptions` array — not in a public file, because every entry quotes the term it exempts and a public allowlist therefore republishes a subset of the vocabulary being withheld. An entry names a path inside the repository being scanned, which is fine in this direction: a private file may name public paths.

An exemption is keyed on **path, category, term and the line it names**. Keying on path and term alone let one exemption absorb the same spelling under a different category, including a category written later, in a private overlay its author never saw. Dropping the line let one exemption suppress every occurrence of that spelling in that file, forever, including occurrences written years later by somebody who never read the entry — and `--audit` called that healthy, because the term was still in the file somewhere.

So `line` is part of the match, with a tolerance of **3 lines** either side. The tolerance is there because an exemption that expired the moment a paragraph was added above it is an exemption people learn to delete rather than read; three lines absorbs an edit around the occurrence and nothing more. A `line` of **0** names the path itself, which is the only position a hit in a filename or a directory name has.

`--audit` reads every entry aloud and reports three states. **ok**: the term is exactly where the entry says. **SHIFTED**: the term has moved, but is still inside the tolerance, so the entry still works — update it, and the audit still passes. **STALE**: the file is gone, no loaded dictionary defines the term under that category any more, the file no longer contains the term at all, or the term has moved further than the tolerance so the entry now suppresses nothing and the hit is back. Stale fails the audit, and the message prints the corrected line so the fix is mechanical.

The `why` is required, as is `line`. An entry missing either is rejected rather than honoured, the hit it was hiding comes back, and the run fails. Every run prints how many exemptions are active and how many hits they suppressed. A suppression nobody re-reads is where a real leak eventually hides.

A hit found in the history cannot be exempted. Its source is a blob and a commit rather than a path in the tree, and the answer to vocabulary in the history is a rewrite, not a note. That is also why `--history` skips the blobs the tracked scan has just read: the current version of every file was already checked, with its exemptions applied, and reporting it again under a source no exemption can name would leave an exempted policy line failing the clearance forever with no remedy short of deleting the word. A gate nobody can ever get green is a gate people stop running. What is left is exactly the question a clearance asks — what is in the object graph that is not in the tree — and the scope line counts the skipped blobs so the omission is stated rather than assumed.

### What the scanner can see

The file list comes from `git ls-files`, so ignored and generated files are never scanned. `--staged` takes its list from the index **and its content from the index too**, via `git cat-file`, so what is checked is what the commit will actually contain: a file staged clean and then dirtied passes, and a file staged dirty and then cleaned fails. Reading the working tree instead had it exactly backwards in both directions.

**Paths are matched as well as contents.** A filename can be the whole disclosure, and a directory named after a client says everything the files inside it were scrubbed of. Every distinct path component — every file name and every directory name above it — is matched once, and a hit in one is reported at line `name` rather than at a line number.

**A symlink is scanned as the path it points at**, which is what the repository actually stores for it. That is also the only content a symlink has that belongs to this repository: a link into a private checkout elsewhere discloses through its target string, and the target's own bytes are not here to read. Symlinked directories are not descended into, so the walk cannot loop.

**Encoding is sniffed, not assumed.** A byte-order mark settles it; without one, a NUL in the first 8 KB sends the bytes to a parity test, because every second byte of UTF-16 ASCII is zero and which half is zero gives the endianness. A file that is binary in every encoding the checker knows is **counted and named in the report** — not silently dropped. Before this, a single NUL byte removed a file from the scan and the run still printed `PASSED`.

Dictionaries are scanned like every other file. Only the exact term strings a dictionary declares — its own vocabulary, and the terms its own exemptions name — are suppressed inside it. Everything else in that file is reported, so a client name typed into a `why` is found rather than sitting in the one file the gate was told to ignore. That is the difference between a suppression and a blind spot, and the coverage line keeps them apart: it counts files that could not be read separately from occurrences deliberately suppressed, because a blind spot counted as coverage is worse than no coverage report at all.

### Matching is not literal

Matching runs on a normalised copy of each text, and every reported position maps back to the characters as written. The evasions a raw per-line match cannot see are undone first:

| Evasion | What it looks like | What is done |
|---|---|---|
| Decomposed accent | a letter written as base plus combining mark | composed |
| A compatibility form | fullwidth `ｚａｒ`, mathematical `𝗓𝖺𝗋`, the `ﬁ` ligature, a circled or superscript letter — including **one** such letter dropped into an otherwise plain word | folded to NFKC, which is what NFC alone walked straight past |
| A homoglyph | Cyrillic `а` for Latin `a`, Greek `ο` for `o` | folded through a table of Cyrillic and Greek Latin-lookalikes |
| A phrase across a wrap | two words of a term split by a line break | phrases match across one line break — never two, so a blank line still separates unrelated words |
| An invisible character | a zero-width space, joiner, bidi mark or soft hyphen inside a word | dropped before matching |
| A percent-encoded link | `%7A%61…` inside a URL | escapes decoded, defensively |

**What the homoglyph fold covers, precisely.** The Cyrillic and Greek letters that are drawn as Latin letters: the Cyrillic `А В Е К М Н О Р С Т У Х Ѕ І Ј Ӏ Ԛ Ԝ Ѵ` and their lowercase forms plus `һ`, and the Greek `Α Β Ε Ζ Η Ι Κ Μ Ν Ο Ρ Τ Υ Χ Ϲ Ϳ` and the lowercase `α β ε ι κ ν ο ρ τ υ χ ϲ`. Around seventy code points in total.

**What it does not cover.** Every other script with Latin lookalikes — Armenian `օ`, Cherokee `Ꭺ`, Coptic, Lisu, Canadian Aboriginal syllabics — and the digit-for-letter substitutions (`0` for `O`, `1` for `l`, `3` for `E`). The full Unicode confusables table is several thousand entries and folding all of it would turn every acronym and every hex string into a candidate; the two scripts above are the ones a realistic evasion reaches for and the ones a keyboard produces by accident. The fold is also one-way and lossy in the other direction: **genuine Cyrillic or Greek text is folded too**, so a repository written in either would see false positives on short terms. That is the right way round for a gate, and it is a real cost, so it is stated here rather than discovered.

Case is ignored throughout. A term marked `word_boundary` matches standing alone, with a regular plural or possessive (`s`, `es`, `'s`), across an underscore or hyphen (`foo_brulq_bar`), and at a CamelCase junction (`getBrulqValue`) — the junction needs a real lowercase-to-uppercase transition on both sides, so `XBRULQX` still does not match. **The residue, stated honestly:** a plural that rewrites the stem (`-y` to `-ies`, or any irregular) is not reachable from a suffix rule and is not caught; an ALL-CAPS run glued to other ALL-CAPS text is not caught, because there is no boundary in it to find; and a letter whose other case is more than one code point (`ß` against `SS`) matches only its own spelling. Terms short enough for any of these to matter should be declared `word_boundary: false` and accepted as noisy, or spelled out in full.

A hit found across a line break reports the line the term starts on, marks how many lines it spans, and echoes the wrapped text as one line with the breaks shown.

### Modes

```sh
bun scripts/leak-check.ts                       # every tracked file and path (the default)
bun scripts/leak-check.ts --staged              # staged content and paths, for a pre-commit gate
bun scripts/leak-check.ts --message <file>      # a commit message, for a commit-msg gate
bun scripts/leak-check.ts --path packages/      # one file or directory
bun scripts/leak-check.ts --history             # ALSO clear the whole history
bun scripts/leak-check.ts --history v1.0..HEAD  # ALSO clear a chosen range
bun scripts/leak-check.ts --audit               # read every exemption and flag the stale ones
bun scripts/leak-check.ts --self-test           # prove the checker against planted fixtures
```

**`--history` is the clearance, and a run without it has not looked at the history at all.** It walks every object reachable from every ref: the content of every blob, every path any object was ever stored under, and every commit message. Blobs are deduplicated by object id, so a file unchanged across five hundred commits is one object, read once and reported once, and the report says how many were read, how many were skipped as the version already read from the index, and how many were skipped as binary or oversized. Each hit names the path and at least one commit that contains it.

The index skip needs the tracked scan to have actually happened, so it applies only to a plain `--history` run. Combined with `--staged` or `--path`, where the file scan covered something narrower than the whole index, nothing is assumed covered and every reachable blob is read.

The flag replaced an earlier `--commits`, which read commit messages and nothing else. That is the one part of the history a scrub never touches, so it reported a rewritten history clean while every superseded version of every file still sat in the object database, reachable and cloneable. Passing `--commits` now fails with an error rather than doing something narrower than its name.

Reads are batched — `git rev-list --objects` for the graph, `git cat-file --batch-check` for the types and sizes, `git cat-file --batch` in chunks for the contents, and one chunk of bodies resident at a time — so the cost is a handful of processes rather than one per object. On this repository, 6,548 reachable objects and 2,009 superseded blobs clear in about five seconds. Matching each blob is screened by a plain lowercase substring search before any pattern runs, because a forty-way alternation of character classes over sixty megabytes is seconds and the screen is milliseconds.

A shallow clone holds only what was fetched and an explicit range may not resolve in one; both still run, and both say so in the scope line, for the same reason a missing overlay does.

`--quiet` drops the per-hit lines and keeps the summaries. Exit code is the verdict: 1 on any unexempted hit or any rejected exemption, 0 on a clean run, 2 when the run could not be performed as asked — a missing or malformed dictionary, a bad option, or `--require-overlay` with no vocabulary loaded.

`--self-test` writes its own fixtures to a temporary directory and never reads the repository, so it proves the checker rather than the contents. It plants **every term of every loaded category**, one file each, because a pattern that fails to match its own term fails one term at a time and a sample of one per category would miss it. Its own invented vocabulary is planted alongside, so the self-test is meaningful with no dictionary present at all. Each evasion in the table above gets a fixture that must be caught, and the shapes the gate must *not* fire on get a control beside them. It also plants a term in a filename, in a directory name and in a symlink target; a UTF-16 file that must be decoded and a binary one that must be counted; snake_case, CamelCase and plural spellings of a bounded term; a phrase followed by 32,000 separator characters, which is the input that used to hang the matcher, timed and required to clear in under two seconds; an empty and a malformed overlay, both of which must fail `--require-overlay`; a commit message that must be stripped the way git strips it; an exemption that must cover one occurrence and not the file; and a throwaway git repository where a file is committed and then deleted, whose blob the history scan must still find and attribute to a commit.

### Wiring

`.github/workflows/leak-check.yml` runs the self-test, the audit and a full-history clearance on every push and pull request, all three with `--require-overlay`. The overlay reaches CI as a secret or as a checkout of the private file, written outside the workspace; when it is absent, empty or malformed the job fails loudly rather than skipping, which is why a pull request from a fork cannot be cleared here.

`hooks/pre-commit` runs `--staged --require-overlay`. `hooks/commit-msg` runs `--message "$1" --require-overlay`, because a pre-commit hook is never handed the message and until it was added a commit message was checked by nothing at all. Install both with:

```sh
git config core.hooksPath hooks
```

That points git at the tracked `hooks/` directory, so both hooks travel with the repository and one setting installs every hook in it. Export `LEAK_TERMS` in your shell profile and every `git commit` inherits it.

Neither hook clears the history — nothing that runs per commit can afford to. **Before a force-push, run the chain below.**

### Before a publish, and before a force-push

```sh
bun scripts/leak-check.ts --terms <overlay> --require-overlay --self-test \
  && bun scripts/leak-check.ts --terms <overlay> --require-overlay --audit \
  && bun scripts/leak-check.ts --terms <overlay> --require-overlay --history
```

Run this before every publish, not only the first, and after every history rewrite. **A public registry blocks unpublishing after 72 hours, and versions that were already resolved stay resolvable regardless.** A leaked commit can be rewritten and force-pushed; a leaked published version cannot be taken back at all. That asymmetry is the whole reason this gate runs before the registry, and not only before the push.

The `--history` step is what makes the second half of that sentence true. Rewriting a history and force-pushing it only helps if the rewrite actually removed the vocabulary, and the only way to know is to walk the object graph afterwards and find nothing. A clearance that read commit messages alone would have said "clean" about a history whose every superseded blob was still there.
