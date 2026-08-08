# Hooks

Host wiring for agent runtimes that offer lifecycle hooks. Two scripts live here, registered in `hooks.json`.

Neither script is part of any skill. Nothing inside any `SKILL.md` names a file in this directory, and nothing in a skill's instructions depends on one having run. That separation is deliberate and is explained under [Adapters, not enforcement](#adapters-not-enforcement).

## `session-start.sh`

Runs once at session start, on startup, clear and compact. It emits an `additionalContext` string naming the standing rules: the engineering skills, the reasoning skill, and each skill under `skills/database/`.

Both skill lists are read from the tree at runtime rather than written down here, so a skill added later announces itself with no edit to the script. The database loop produces nothing at all while `skills/database/` is absent, which keeps the hook correct in a checkout that does not have those skills yet.

The database skills get one line each rather than a shared line, because each guards a different subject and a reminder that does not say what it guards is not a reminder.

## `pre-tool-use.sh`

Runs before a tool call, receives the invocation as JSON on stdin, and has two jobs.

**Observe.** Invoking a skill, or reading a file inside a skill's own directory, records that skill as loaded for the rest of the session.

**Gate.** An edit or write under a tree governed by one of those skills, where the skill has not been recorded as loaded, is denied once with a reason naming the skill and why that tree needs it.

| Path being written | Skill named in the denial |
|---|---|
| `.maccing/growth/**` | `growth` |
| `.maccing/database/MAPPING.md` | `database-mapping` |
| everything else under `.maccing/database/**`, or under a `database-ops/` tree | `database-ops` |

The map is checked before the tree around it, because it is the mapping skill's subject even though it sits inside the ops skill's directory.

A read counts as a load when the path falls inside the skill's own tree — `skills/database/mapping/` and `skills/database/ops/` for the two database skills, and the whole `skills/growth/` family for `growth`, since any platform skill under it routes back through the orchestrator. Matching the family rather than the single directory is deliberately generous: the cost of a missed reminder is one skipped nudge, and the cost of a spurious one is an agent being told to load a skill it already has open.

### The no-op is silence, not an allow decision

When the hook has nothing to say it exits 0 and prints nothing. It never emits `permissionDecision: "allow"`.

The two are not interchangeable. An explicit allow is a positive grant that suppresses whatever the host would otherwise have done — its own permission rules, a configured prompt, another hook's opinion. This hook knows one narrow thing, and that is not a basis for approving an edit on everyone else's behalf. Silence lets the host's normal decision stand, which is what "no opinion" should mean.

### It fails open, always

Every unexpected condition exits 0 with no output: stdin is a terminal, stdin never closes, the payload is not JSON, `jq` is not installed, the tool shape has no path field, there is no session id, the temp directory cannot be created.

A hook that cannot read its own input must step aside. Blocking one unadvised edit is worth something; blocking every edit in the session because a field moved is worth far less than nothing, and it is the failure mode that gets hooks deleted rather than fixed.

Reading stdin uses a per-line timeout for the same reason, so a host that opens the pipe and never writes to it cannot wedge the process.

### The marker file is a reminder, not a boundary

A hook runs in its own process. It cannot see the agent's context, so it cannot actually know whether a skill was loaded. What it has instead is a marker file under a temp directory keyed by the session id, written when the hook observes something that looks like a load.

State that plainly: **this is a reminder mechanism with a real bypass, not a security boundary.** The gaps are known and are not defects to be closed.

- Opening a skill's file marks it loaded. Nothing verifies the contents were read, and nothing verifies they were followed.
- Loading the skill by a route the hook never sees — a host feature that injects it, a tool this script does not match — leaves the marker unwritten, and the reminder fires against an agent that has already done the right thing.
- The denial fires **once per skill per session**. A second attempt at the same tree passes. This is intentional: the hook cannot confirm the agent complied, so a hook that kept denying would eventually be denying correct work with no way out, which is the wedge described above wearing a different hat.
- Markers live in a temp directory. Clearing it re-arms every reminder, and nothing stops anything else from writing there.

The upside is that the reminder arrives at the moment of the edit, attached to the file being edited, which is when it is most likely to be acted on. That is the whole of what this layer buys, and it is worth having on hosts that offer it.

## Adapters, not enforcement

The requirement is that a skill gets reached for whenever the work touches its subject. The strongest available gate is also the least portable, so the design puts the requirement in the layers every host already reads:

| Layer | Portable | What it does |
|---|---|---|
| Skill description | yes | Forced-loading phrasing — before the first action on any task touching the subject, however trivial |
| Skill body | yes | The mandatory first-step block at the top of the `SKILL.md` |
| Cross-skill reach | yes | A substrate skill named as required by each skill that depends on it |
| `session-start.sh` | no | Names the standing rules once per session |
| `pre-tool-use.sh` | no | Reminds at the moment of the edit |

The first three are the enforcement, and they carry it on their own. The description is the layer that actually fires, because every host that loads skills reads descriptions; the body holds once loaded; the cross-skill reference pulls a substrate in without either host hook existing.

The two hooks are adapters. Where a host offers them they are wired, and where it does not, **nothing structural is lost** — no skill changes behaviour, no instruction becomes unreachable, no step goes missing. A skill that needed a hook to be correct would be a skill that only works on one runtime, which is the outcome this arrangement exists to avoid.

This also fixes the direction of the dependency. The hooks know about the skills; the skills know nothing about the hooks. That is why no `SKILL.md` may name a file in this directory: the moment one does, the adapter has become a requirement, and the skill has quietly stopped being portable.

## Adding a governed tree

Everything per-skill lives in the small table of functions at the top of `pre-tool-use.sh`: add the skill to `KNOWN_SKILLS`, add its path pattern to `governing_skill`, add its directory to `skill_home`, and write its one-sentence `deny_reason`. Nothing below that block is per-skill.

Then check the reverse direction: the skill's own description and body must already carry the requirement without this hook. If they do not, fix that first. The hook is the last layer to add, never the first.
