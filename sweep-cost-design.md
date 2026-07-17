# Design spike — the ancestral `AGENTS.md` sweep cost: is there a safe, worthwhile fix?

**Scope:** analysis only. No files changed, no Notion writes. Ground truth was gathered by reading the five live playbooks (reads are free) and the tool source; all real ids / the workspace space-id are deliberately kept out of this report.

---

## RECOMMENDATION (decision-ready, verbatim)

> **Safe but needs André's taste — nice-to-have, do not auto-do.**
>
> There is **no safe *automatable* tool/algorithm fix.** Summarizing the ancestors (A), a caller-opt-in `depth` param (B), any output-side digest, and the already-pulled session cache **all drop or gate binding rule-text and loosen the `AGENTS.md` correctness gate — the same failure class.** The only gate-preserving cost reduction is **trimming each playbook to its operational-Notion core**: dated changelog → Notion page-history/git; Notion-API mechanism → the `maccing-notion` skill (where it already lives); the training/cardio domain-doctrine essays → a linked **non-`AGENTS.md`** reference read on demand. That is **≈ half the sweep's bytes** (the Workout playbook dominates), and it carries **zero gate risk *only when a human who understands the semantics does it*** — to preserve the "don't-regress" rules that hide inside changelog lines and to verify the skill already covers each mechanism. So it is an **opinionated edit of André's workspace content, not a repo change, and not auto-doable.**
>
> **Optional safe repo enabler:** add a "keep playbooks operational" authoring norm to `skills/notion/notion/references/agents-md-authoring.md`. It prevents future bloat and gives André the trim criteria — but it does **not** itself shrink the existing playbooks.

**One-line why:** the sweep's cost *is* the price of its correctness guarantee; every lever that cuts cost automatically also cuts the guarantee, and the one lever that keeps the guarantee (curate the content) is a judgment call only André can sign off.

---

## The invariant any fix must preserve (derived from the pulled-cache post-mortem, `33d4280`)

The gate exists so that **before acting on a Notion target, the acting agent has, as literal text in its current context, every currently-binding rule from every governing playbook** — so it cannot violate a rule it never saw.

The session cache (`19a1c91`) was pulled because a "still governs / unchanged" marker **cannot guarantee the earlier playbook text is still in the reader's context** — context compacts in long sessions, and subagents share the process cache but not the context. A marker asserting "unchanged" while the text is gone loosens the gate.

**So the bar for "safe" is exact:** the reader must end up with all currently-binding rules *as text in context at act-time*. A fix may reduce **what counts as a binding rule that must be present** only if it provably drops **nothing** an agent needs to act correctly. "Provably" is the whole game — a heuristic that is *usually* lossless fails the bar, because the failure is silent and the gate is load-bearing.

---

## Per-lever verdict table

| Lever | What it does | Adversarial failure mode | Verdict |
|---|---|---|---|
| **A — summarize ancestors, keep closest full** | Return root/intermediate playbooks as a digest; only the closest verbatim | Ancestors carry **non-conflicting binding rules the closest never restates** (verified: Workout/Nutrition don't restate root's "Databases are plural", pt-BR money, 🤖-icon, nav-hub `property_visibility`). A lossy digest drops one → a new DB gets named "Backup" not "Backups", casing drifts, money format wrong. To be lossless the tool must know *which rules bind this task* — task-semantics it does not have. A "lossless-of-rules" digest = the original minus clearly-non-binding sections = **lever C by another name**, which needs human semantics. | **UNSAFE** as automation. No provably-safe automated variant exists; it collapses into C. |
| **B — caller-opt-in `depth=closest\|all` (default `all`)** | Let the caller request only the closest playbook | **Identical failure class to the pulled cache**: it hands the *agent* the judgment "do I need the ancestors this time?" under the exact pressures the skill's own red-flags name ("it's a one-field edit", "I'm in a hurry"). The first time `depth=closest` is chosen for a task touching a root-governed convention, the gate is loosened. `default=all` mitigates nothing — the lever's entire purpose is that someone starts choosing `closest`. The tool cannot verify a closest playbook is self-contained (none of the five are). | **UNSAFE.** Same class as the pulled cache. |
| **C — trim playbooks to operational-only** | Remove dated changelog, skill-duplicated mechanism, and domain-essays from the `AGENTS.md` pages | The content removed is genuinely non-binding for Notion correctness — **but** some "changelog" lines double as **don't-regress rules** ("changed from rolling windows → calendar weeks", "the Chest Fri→Sun error", "never same muscle <48 h"); naively deleting them as history drops a *current* constraint. And "mechanism is in the skill" must be *verified* per gotcha. Both are semantic judgments → not machine-decidable (which is exactly why it can't be a tool feature). | **SAFE only with human curation.** Zero gate risk when André (or an agent with his sign-off) does it. **Not a repo change** (playbooks live in his Notion). Real payoff. → nice-to-have. |
| **D1 — split domain-essays to a linked non-`AGENTS.md` reference** | Move Workout §10 (training science) / §11 (cardio science) to a "Training science" child page read on demand | Surgical variant of C: an agent renaming a column never needed the VO₂max essay, so the sweep needn't carry it. But deciding "this doctrine isn't gate-critical" is André's product call — he put it in `AGENTS.md` *so an agent coaches by his doctrine when planning*. | **SAFE only with André's taste.** Biggest single byte win; taste-owned. |
| **D2 — tool strips fenced code / raw id dumps from output** | Shrink the returned text mechanically | Those ids/formulas **are** operational (needed for API calls); stripping forces a re-fetch (no net saving) or breaks a task that needed the id. | **UNSAFE / counterproductive.** |
| **D3 — repo authoring norm in `agents-md-authoring.md`** | Document "keep `AGENTS.md` operational; changelog→page-history, mechanism→skill, domain-doctrine→linked ref" | Touches no André content and no tool; the gate still reads every `AGENTS.md` in full, so it **cannot** loosen the gate. It is *preventive* — it does not shrink the existing five. | **SAFE, automatable, small.** Prevents future bloat + supplies the C/D1 criteria. Does not reduce current cost by itself. |
| **(excluded) — session cache w/ unchanged-marker** | (already built & pulled in `33d4280`) | Marker can't guarantee elided text is still in context (compaction / subagents). | **UNSAFE.** Do not re-propose. |

---

## Lever C — quantifying the composition of the 5 playbooks

Method: I read all five live playbooks and classified their content into four buckets. Percentages are **byte-share estimates from categorizing sections**, not exact token counts (labelled as estimates — the recommendation does not hinge on the exact figure). Token sizes are `≈ chars/4` estimates.

**Buckets**
- **Operational-Notion** — binding: house-style rules, current map, current schema/ids, conventions, the "recurring task" procedure, current view config, red flags. *This is what the gate is for; cannot be dropped.*
- **Historical-changelog** — dated narrative of how it reached "now" ("split 2026-06-24", "deleted 2026-06-17", "was a rollup until 2026-07-17"). *Belongs in Notion page-history / git — except the don't-regress subset.*
- **Mechanism-already-in-skill** — general Notion-API technique (`formula2` AST via `saveTransactions`, no rollup-of-rollup, RE2 no-lookahead, public-API formulas not filterable, BRL formatter). *The `maccing-notion` skill is always loaded when the sweep runs, so the playbook re-explaining it adds no gate value.*
- **Domain-knowledge essay** — evidence-based fitness doctrine (training science, cardio/VO₂max). *Not Notion-correctness; operational only for "plan my workout".*

| Playbook | Est. size | Operational | Changelog | Mechanism-in-skill | Domain-essay | Trim note |
|---|---|---|---|---|---|---|
| **LifeOS (root)** | ~850 tok | **~90%** | ~10% | ~0% | 0% | Lean; a model playbook. Almost nothing to trim. |
| **Health** | ~1,300 tok | ~70% | ~20% | ~10% | 0% | Dated "moved/renamed/removed 2026-06-19" notes → page-history. |
| **Workout** | **~4,000–4,500 tok** (dominates the biggest chain) | **~30–35%** | ~20% | ~10–15% | **~30–35%** (§10/§11) | **Where nearly all savings live — and the most taste-laden.** §7 = pure mechanism; §9 = a dated redesign log; §10/§11 = fitness doctrine. |
| **Nutrition** | ~1,400 tok | ~70% | ~15% | ~15% | 0% | Mechanism cross-refs + a few TRASHED/SUPERSEDED notes. |
| **Investments** | ~1,500 tok | ~50% | ~10% | **~35–40%** (§7–§8) | 0% | §7 "hard-won gotchas" + §8 BRL formatter = textbook mechanism-in-skill → one-line pointer. |

**Aggregate:** operational-Notion ≈ **40–50%** of sweep bytes; the remaining **~50–60%** splits across changelog (~15–20%), mechanism-in-skill (~15–20%), and domain-essay (~15–20%, almost entirely in Workout).

**Chain cost (the thing the spike is about):** the **Health/Workout chain** (`LifeOS › Health › Workout`) is the biggest at **≈ 6–7k tokens of content** (+ tool wrapper) — order-of-magnitude consistent with the "~10k" premise; the Workout playbook alone is ~two-thirds of it. The Investments chain is only 2 playbooks (`LifeOS › Finance › Investments`; Finance has no `AGENTS.md`) ≈ 2.3k tokens. **Trimming Workout is where the lever pays off** — and it is exactly the content whose removal is a product/taste decision (André's training doctrine + don't-regress warnings).

**Is C zero-gate-risk?** Yes for the *bytes* (they aren't binding Notion rules) — **but only a human who reads for the don't-regress lines and verifies skill-coverage can remove them without accidentally dropping a live constraint.** That non-machine-decidability is precisely why C can't become a tool feature (it would reintroduce the A/B/cache failure).

**Repo or André's content?** The five playbooks are `AGENTS.md` child-pages **in André's Notion workspace** — the repo holds only the *skill* and the *tool*. So the trim is **an edit of André's content, not a repo change.** The only repo-side move is D3 (the authoring norm), which is preventive.

---

## The one concrete, safe, repo-side change (D3) — spec + adversarial test

Not the headline fix (it doesn't shrink the current sweep), but it is safe, automatable, and enables the C/D1 cleanup. Offered as a nice-to-have; **not implemented** (this spike changes no files).

**Spec — append to `skills/notion/notion/references/agents-md-authoring.md`:**

> **Keep an `AGENTS.md` operational — it is read in full on *every* task, so every non-binding line is a tax on all of them.** Include only what an agent must have *as text* to act correctly here: house-style deltas, the current map + ids, current schema/conventions, the recurring-task procedure, current view config, red flags. **Move out:**
> - **Change history** ("split 2026-06-24", "was a rollup until…") → Notion page-history / git. **Exception — keep any line that states a *current* constraint** ("use calendar weeks, not rolling"; "never the same muscle < 48 h"). Rewrite it as a present-tense rule, not a dated diff.
> - **General Notion-API mechanism** (`formula2` AST, no rollup-of-rollup, RE2 no-lookahead, BRL formatter) → the `maccing-notion` skill, referenced by one pointer line. The skill is already loaded when the sweep runs.
> - **Domain-knowledge essays** (e.g. training/nutrition doctrine) → a linked **non-`AGENTS.md`** reference the agent opens when the task needs it — so the sweep doesn't carry it every time.

**How to adversarially test it (RED → GREEN, per `writing-skills`):**
1. **RED:** take the current Workout playbook, enumerate its **binding rules** (every imperative/house-style/schema/id/don't-regress line) as a checklist. Apply the norm to produce a trimmed draft. **Diff the binding-rule checklist before vs after — any dropped binding rule is a FAIL.** The norm passes only if the diff is empty (the "don't-regress" exception is the line most likely to be wrongly cut — the test must include at least one such line, e.g. the calendar-week and 48 h rules).
2. **Adversarial reader:** hand the trimmed playbook to a fresh agent with a task that depends on a *moved* item (rename a DB → needs root "plural" rule; author a relation-read formula → needs the mechanism pointer resolves; plan a workout → needs the linked training-science ref). If any task now acts wrongly, the trim removed something binding → FAIL.
3. **Regression on the gate:** confirm `read_agents_md` still returns **every** `AGENTS.md` in full after the trim (the norm changes *content*, never the sweep's completeness). The gate's coverage must be untouched.

---

## Risk / what I did **not** check (labels)

- **Token figures are estimates** (`≈ chars/4`, byte-share classification), not measured token counts — I could not fetch precise counts (the MCP's `/markdown` endpoint needs the server-side `NOTION_TOKEN`, absent from this shell). The **order of magnitude and the composition ratio** are what the verdict rests on; both are robust to ±30% on the absolute numbers.
- **Classification is my judgment**, task-context-free. The one place it matters — the don't-regress-vs-changelog boundary — is exactly where I flag human curation is required, so the uncertainty *reinforces* the "needs taste" verdict rather than undermining it.
- **Rival hypotheses I tried and rejected:** (a) "A can be a deterministic date-line/code-block stripper" — dies because binding rules appear in prose and dated lines can carry current facts ("Bodyweight moved out 2026-06-19 — now on the Body page" mixes a date with a live location). (b) "`depth=closest` is safe when the closest is self-contained" — none of the five are, and the tool can't verify self-containment. (c) "reads don't need the full gate" — the skill and the Investments all-BRL USD-rate caveat both show a *read that draws a conclusion* needs the playbook.
- **If this fails anyway, look first at:** a future skill instruction (or agent habit) that starts calling any cost-reducing path (`depth`, a digest, a revived cache) — that is the trip-wire that would loosen the gate. The gate holds as long as the sweep returns every playbook in full, verbatim.

## Security aside (not a cost lever, but surfaced while reading)
The **Workout** playbook §2 stores the workspace **space-id in plaintext**. The repo's own rules classify the space-id as a secret. It lives in André's private workspace (not a committed skill file), so the exposure is limited — but worth a one-line heads-up to André that a playbook is a place a secret can leak from if that page is ever shared/exported.
