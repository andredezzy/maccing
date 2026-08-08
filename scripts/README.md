# Repository scripts

## `leak-check.ts`

This repository is public. Some of the work that produced it was not. `leak-check.ts` scans for vocabulary carried over from private engagements and fails the run if any of it appears — in a tracked file, in a staged change, or in a commit message.

### The dictionary is split, on purpose

`leak-terms.json`, next to the script, holds only vocabulary that is generic by nature: category words anyone might ban, naming nobody. Names, numbers and anything else specific to a piece of private work belong in an **overlay** that never lands in this repository:

```sh
bun scripts/leak-check.ts --terms ~/private-work/leak-terms.json     # repeatable
LEAK_TERMS=~/a.json:~/b.json bun scripts/leak-check.ts               # colon-separated
```

A public denylist of private names would publish exactly what it exists to protect, and hashing a short name against a public salt is a dictionary attack rather than protection. An overlay uses the same schema. Categories with the same name pool their terms and a term already defined keeps its first definition, and the run names both so that a merge can never be read as a replacement. An overlay that is itself inside this repository is refused outright: dictionaries are skipped by the scan so the checker does not fail on its own vocabulary, which would make a committed overlay the one file its own terms could never be found in.

Because a half-loaded dictionary is the failure mode nobody notices, **every run prints which dictionaries it loaded and how many terms each supplied**, and repeats the count on the final PASSED/FAILED line. A run with no overlay says so in as many words.

Short or ambiguous terms match as whole words only, so a three-letter term does not fire on every hash in the repository and a four-letter one does not fire on ordinary English that happens to contain it. Longer, unambiguous terms match anywhere, including glued inside a slug, an identifier or a URL. Multi-word terms tolerate spaces, underscores or hyphens between the words. Each term's entry records which rule it uses and why.

### Exemptions

Policy prose and disclosure look identical to a substring match. A skill that documents which categories an ad network prohibits has to name them, and a localised product name or an ordinary English word will sometimes collide with a banned term. `leak-allow.json` carries those cases: a repository-relative path, the term it exempts in that file, and a `why`.

The `why` is required. An entry without one is rejected rather than honoured, the hit it was hiding comes back, and the run fails. Every run prints how many exemptions are active and how many hits they suppressed, and `--audit` reads each one aloud with its reason, failing on any whose file has gone or no longer contains the term. A suppression nobody re-reads is where a real leak eventually hides.

### Modes

```sh
bun scripts/leak-check.ts                      # every tracked file (the default)
bun scripts/leak-check.ts --staged             # only staged files, for a pre-commit gate
bun scripts/leak-check.ts --path packages/     # one file or directory
bun scripts/leak-check.ts --commits            # also commit messages, HEAD~50..HEAD
bun scripts/leak-check.ts --commits v1.0..HEAD # a chosen range
bun scripts/leak-check.ts --audit              # read every exemption and flag the stale ones
bun scripts/leak-check.ts --self-test          # prove the checker against planted fixtures
```

`--quiet` drops the per-hit lines and keeps the summaries. Exit code is the verdict: 1 on any unexempted hit or any rejected allowlist entry, 0 on a clean run, 2 on a usage error such as a missing dictionary. Any mode drops straight into a hook or a CI step.

The file list comes from `git ls-files`, so ignored and generated files are never scanned. Binary files are detected by a NUL byte in their first 8 KB and skipped. The dictionaries and the allowlist skip themselves, since they quote banned terms by definition. The final line reports how many files were scanned and how many were skipped, because a gate's coverage is part of its verdict.

`--self-test` writes its own fixtures to a temporary directory: one planted violation per loaded category, plus a control line holding every whole-word term buried inside a longer token. It passes only if all the planted terms were found, none of the buried ones were, and both a hit and a rejected allowlist entry map to exit code 1. It never reads the repository, so it proves the checker rather than the contents.

### Before a publish

```sh
bun scripts/leak-check.ts --self-test \
  && bun scripts/leak-check.ts --audit \
  && bun scripts/leak-check.ts --terms <overlay> --commits
```

Run this before every publish, not only the first. **A public registry blocks unpublishing after 72 hours, and versions that were already resolved stay resolvable regardless.** A leaked commit can be rewritten and force-pushed; a leaked published version cannot be taken back at all. That asymmetry is the whole reason this gate runs before the registry, and not only before the push.
