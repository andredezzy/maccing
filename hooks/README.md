# Hooks

Three git hooks live here: `pre-commit`, `commit-msg` and `pre-push`. Git fires them, they are registered nowhere, and they do nothing at all until somebody installs them. `git config core.hooksPath hooks` installs all three at once.

They cover three different ways the same vocabulary reaches a remote, and none of them stands in for another: a pre-commit hook is never handed the commit message, and neither of those two ever sees the history that a push is what actually publishes. What they run is in [`.github/scripts/leak-protection.md`](../.github/scripts/leak-protection.md), beside the checker they gate.

## Nothing in a skill may name a file here

No `SKILL.md` names a file in this directory, and nothing in a skill's instructions depends on one having run.

The dependency only runs one way: the hooks may know about the skills, the skills know nothing about the hooks. The moment a skill names one, that hook has stopped being an optional local gate and become a requirement — and the skill has quietly stopped working anywhere the hook is not installed. A skill that needs a hook to be correct is a skill that only works on one machine.

The requirement a skill carries has to live in the layers every host already reads: the description's forced-loading phrasing, the mandatory first-step block in the body, and a substrate skill named as required by each skill that depends on it. Those three are the enforcement and they carry it on their own.

## History

Two agent-runtime hooks used to live here — `session-start.sh` announced the standing rules once per session, and `pre-tool-use.sh` denied an edit under a governed tree until the governing skill had been loaded. Both were removed on 2026-08-11 along with `hooks.json` that registered them.

They were adapters, never enforcement: they only ran on a host that offered lifecycle hooks, and the three portable layers above already carried the requirement without them. The gate in particular was a reminder with a real bypass rather than a boundary — it could not see an agent's context, so it inferred a skill was loaded from a marker file, and opening a skill's file was enough to mark it.
