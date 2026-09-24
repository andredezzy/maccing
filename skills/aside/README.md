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
| **aside** | — | **What every Aside site skill shares**: loading Aside's official `aside-browser` skill and its built-in site skills first, profiles and accounts, one-shot `aside repl` sessions, getting files in, `aside exec` without credits, REPL behaviour, reading without printing other people's content, how to add a site skill |
| aside-magnific | aside | Magnific (formerly Freepik): the account check, paid runs behind the user's yes, no-credit Unlimited generation behind a guard, the Image Generator, one-shot call planning, the shared Creations feed and full-size downloads |
| aside-shopee-seller | aside | Shopee Brasil Seller Centre: account check, guarded saves, listings, listing copy, shop profile, product diagnostics |

## Two readers

- **A coding agent** (Claude Code, Codex, …) runs `aside repl` from a shell. Each call is a fresh session; `aside/references/terminal.md` covers what that changes.
- **The Aside agent** reads the same files from `~/.aside/u/<n>/skills/user/`, linked there, with its own REPL tool. `aside/references/new-site-skill.md` says how to link them.
