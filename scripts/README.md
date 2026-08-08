# Repository scripts

## `leak-check.ts`

This repository is public. Some of the work that produced it was not. `leak-check.ts` scans for vocabulary carried over from private engagements and fails the run if any of it appears — in a tracked file, in a staged change, or in a commit message.

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

### A run without an overlay is not a pass

Because the shipped dictionary matches nothing, a run with no overlay checks no name and no figure, prints `PASSED` and exits 0 — the same exit code as a complete run. The header says an overlay is missing, which protects a human reading the output, but a hook and a CI step read only the exit code.

`--require-overlay` closes that. It fails, with exit code 2, any run that merged no overlay dictionary — 2 rather than 1, because the gate could not be run as asked rather than having found something. **Pass it everywhere the checker is invoked as a gate**, which is what the workflow and the hook below both do.

Every run also prints which dictionaries it loaded and how many terms each supplied, and repeats the count on the final `PASSED`/`FAILED` line, because a half-loaded dictionary is the failure mode nobody notices.

### Exemptions travel with the dictionary

Policy prose and disclosure look identical to a substring match. A skill that documents which categories an ad network prohibits has to name them, and a localised product name or an ordinary English word will sometimes collide with a banned term. Those cases are named in the overlay's `exemptions` array — not in a public file, because every entry quotes the term it exempts and a public allowlist therefore republishes a subset of the vocabulary being withheld. An entry names a path inside the repository being scanned, which is fine in this direction: a private file may name public paths.

An exemption is keyed on **path, category and term together**. Keying on path and term alone let one exemption absorb the same spelling under a different category, including a category written later, in a private overlay its author never saw. An exemption should cover the occurrence it was written for.

Each entry also records the `line` it was written for. The line is not part of the key — an exemption that expired every time a paragraph was added above it would be an exemption people learn to delete rather than read. `--audit` uses it to report **drift**: the term is still there, under a different line number, and the entry should be updated. Drift is reported with the corrected line and does not fail the audit. A missing file, a term the dictionaries no longer define, and a term no longer present in the file are **stale**, and stale does fail.

The `why` is required, as is `line`. An entry missing either is rejected rather than honoured, the hit it was hiding comes back, and the run fails. Every run prints how many exemptions are active and how many hits they suppressed. A suppression nobody re-reads is where a real leak eventually hides.

### What the scanner can see

The file list comes from `git ls-files`, so ignored and generated files are never scanned. Binary files are detected by a NUL byte in their first 8 KB and skipped.

Dictionaries are scanned like every other file. Only the exact term strings a dictionary declares — its own vocabulary, and the terms its own exemptions name — are suppressed inside it. Everything else in that file is reported, so a client name typed into a `why` is found rather than sitting in the one file the gate was told to ignore. That is the difference between a suppression and a blind spot, and the coverage line keeps them apart: it counts files that could not be read separately from occurrences deliberately suppressed, because a blind spot counted as coverage is worse than no coverage report at all.

### Matching is not literal

Matching runs on a normalised copy of each file, and every reported position maps back to the bytes as written. Four evasions that a raw per-line match cannot see are undone first:

| Evasion | What it looks like | What is done |
|---|---|---|
| Decomposed accent | a letter written as base plus combining mark | composed to NFC |
| A phrase across a wrap | two words of a term split by a line break | phrases match across one line break — never two, so a blank line still separates unrelated words |
| An invisible character | a zero-width space, joiner, bidi mark or soft hyphen inside a word | dropped before matching |
| A percent-encoded link | `%7A%61…` inside a URL | escapes decoded, defensively |

Case is ignored, and the word-boundary rule that stops a short term matching inside a longer word is unaffected by any of it. A hit found across a line break reports the line the term starts on, marks how many lines it spans, and echoes the wrapped text as one line with the breaks shown.

### Modes

```sh
bun scripts/leak-check.ts                      # every tracked file (the default)
bun scripts/leak-check.ts --staged             # only staged files, for a pre-commit gate
bun scripts/leak-check.ts --path packages/     # one file or directory
bun scripts/leak-check.ts --commits            # also commit messages, the whole history
bun scripts/leak-check.ts --commits v1.0..HEAD # a chosen range
bun scripts/leak-check.ts --audit              # read every exemption and flag the stale ones
bun scripts/leak-check.ts --self-test          # prove the checker against planted fixtures
```

`--commits` reads the whole history by default. The reason to scan commit messages at all is a post-rewrite clearance, where a pass reads as "the history is clean", so a window over the most recent few dozen commits is the one default that cannot be right. A shallow clone holds only what was fetched and an explicit range may not resolve in one; both still run, and both say so in the scope line, for the same reason a missing overlay does.

`--quiet` drops the per-hit lines and keeps the summaries. Exit code is the verdict: 1 on any unexempted hit or any rejected exemption, 0 on a clean run, 2 when the run could not be performed as asked — a missing dictionary, a bad option, or `--require-overlay` with no overlay.

`--self-test` writes its own fixtures to a temporary directory and never reads the repository, so it proves the checker rather than the contents. It plants **every term of every loaded category**, one file each, because a pattern that fails to match its own term fails one term at a time and a sample of one per category would miss it. Its own invented vocabulary is planted alongside, so the self-test is meaningful with no dictionary present at all. Each of the four evasions above gets a fixture that must be caught and a control that must not fire, and the run also checks that a dictionary's undeclared vocabulary is still reported inside it, that an exemption suppresses only the category it names, and that a hit and a rejected exemption both map to exit code 1.

### Wiring

`.github/workflows/leak-check.yml` runs the self-test, the audit and a full-history scan on every push and pull request, all with `--require-overlay`. The overlay reaches CI as a secret or as a checkout of the private file, written outside the workspace; when it is absent the job fails loudly rather than skipping, which is why a pull request from a fork cannot be cleared here.

`hooks/pre-commit` runs `--staged --require-overlay`. Install it with:

```sh
git config core.hooksPath hooks
```

That points git at the tracked `hooks/` directory, so the hook travels with the repository. Export `LEAK_TERMS` in your shell profile and every `git commit` inherits it.

### Before a publish

```sh
bun scripts/leak-check.ts --self-test \
  && bun scripts/leak-check.ts --terms <overlay> --require-overlay --audit \
  && bun scripts/leak-check.ts --terms <overlay> --require-overlay --commits
```

Run this before every publish, not only the first. **A public registry blocks unpublishing after 72 hours, and versions that were already resolved stay resolvable regardless.** A leaked commit can be rewritten and force-pushed; a leaked published version cannot be taken back at all. That asymmetry is the whole reason this gate runs before the registry, and not only before the push.
