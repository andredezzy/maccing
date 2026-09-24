# Adding an Aside site skill

A site skill teaches Aside one website. It is a child of this skill: it holds what is true of that site, and points here for everything that is true of Aside.

Write one only for a site Aside does not ship a skill for. Check both places the parent's Iron Law 1 names first.

## Where it lives

A folder directly under `skills/`, named `aside-<site>`, holding `SKILL.md` and, when the detail outgrows it, `references/`. List it in this skill's "Child skills" line, in [`../README.md`](../README.md), in the repository's root `README.md`, and in both `plugin.json` and `.claude-plugin/plugin.json`.

## Frontmatter

```yaml
---
name: aside-<site>
description: Use when … (the site's name, its domain, and what a user asks for on it)
autoInject:
  keywords: ["<site>", "<words a user types>"]
  url:
    - "<host>/**"
---
```

`name` matches the folder. `autoInject` is read by the Aside app only: it loads the skill when a task names a keyword or a tab opens a matching URL. Other hosts ignore it.

## The body

1. The `> **Depends on:**` line, copied from an existing child. It loads `aside` first and runs its Iron Laws, so Aside's official `aside-browser` skill comes before this one. Add the parent references this site uses, as `../aside/references/<file>.md`.
2. The site's canonical URLs. For anything else, follow the site's navigation; never guess a URL.
3. The account check: how to confirm which account is logged in before any action.
4. The actions others can see, or that spend money, and the guard before each one (the parent's rule 4).
5. Site behaviour in the REPL that the parent does not cover. Anything true of every site belongs in `references/repl.md` here instead.
6. A table routing each area of the site to a reference file.

Keep `SKILL.md` lean and the detail in references. Every reference ends with a "Dated examples (YYYY-MM-DD; not rules)" section: the labels, values and timings seen on that day. Nothing volatile appears outside it as a rule.

## Before it ships

Give a fresh agent only the parent, the new child and the installed `aside-browser` SKILL.md, and ask it how it would do the site's riskiest task. It must name loading and updating `aside-browser`, the built-in skill check, the account check, the guard and the right parent reference, without acting. Fix what it misses.

## The Aside app's copy

The Aside agent reads user skills from `~/.aside/u/<n>/skills/user/`, and its loader follows symbolic links. Link each child there rather than copying it. Never link this parent as a skill: the Aside app ships a builtin skill also named `aside`, and a user skill of the same name replaces it. To give the Aside agent the parent's files, make `skills/user/aside/` a plain folder holding a link named `references` to this skill's `references/`; a folder without a `SKILL.md` registers no skill, and the children's `../aside/references/` paths resolve through it.
