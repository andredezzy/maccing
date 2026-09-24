# aside

Site skills that drive websites through the [Aside](https://aside.com) browser, in the user's logged-in sessions. Every skill here first loads Aside's official `aside-browser` skill, and stops when Aside is missing.

## Skills

Each skill is its own folder directly under `skills/`, named exactly as the skill. The children load the parent first.

```
skills/
  aside/                  the parent: Aside itself, profiles, one-shot `aside repl`, adding a site skill
  aside-magnific/         the Magnific web app
  aside-shopee-seller/    the Shopee Brasil Seller Centre
```

| Skill | Parent | Purpose |
|-------|--------|---------|
| **aside** | — | **What every Aside site skill shares**: loading Aside's official `aside-browser` skill first, letting an Aside built-in site skill lead where one exists, profiles and accounts, one-shot `aside repl` sessions, a background session that keeps its tab across calls ([`scripts/repl-send.sh`](scripts/repl-send.sh)), getting files in, checking local pages, `aside exec` without credits, REPL behaviour, reading without printing other people's content, how to add a site skill |
| aside-magnific | aside | Magnific (formerly Freepik): the account check, one message for every question, paid runs behind the user's yes, no-credit Unlimited generation behind a guard that checks the switch, model and settings, the Image Generator, one-shot call planning, prompt pitfalls, reusing uploaded references, the shared Creations feed with an anchor for your new card, and full-size downloads that refuse a preview. The REPL helpers ship as one file each in [`scripts/`](../aside-magnific/scripts/) |
| aside-shopee-seller | aside | Shopee Brasil Seller Centre: account check, guarded saves, listings (guided tours, pre-filled attributes, image replacement, a Quill description), listing copy, shop profile, product diagnostics. The REPL helpers ship as one file each in [`scripts/`](../aside-shopee-seller/scripts/), with a Bun check of live image order |

## Two readers

- **A coding agent** (Claude Code, Codex, …) runs `aside repl` from a shell. Each call is a fresh session; [`references/terminal.md`](references/terminal.md) covers what that changes.
- **The Aside agent** reads the same files from `~/.aside/u/<n>/skills/user/`, linked there, with its own REPL tool. [`references/new-site-skill.md`](references/new-site-skill.md) says how to link them.
