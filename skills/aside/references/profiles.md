# Profiles and accounts

Each Aside profile is a separate browser with its own logins. A site can be logged in on one profile and not another, and a user who runs several accounts on one site usually keeps each on its own profile.

## The commands

- `aside account list` prints the profile ids (`u0`, `u1`, …), the Aside account each is signed in to, and whether it is signed in.
- `aside repl --account <id> "<code>"` runs in that profile's browser. It works whether or not the profile is signed in to Aside.
- `aside exec --account <id>` runs the Aside agent there. It needs the profile signed in to Aside.
- `aside settings set-default-profile <id>` changes the default for later commands. Prefer `--account` on each call, so one task cannot move another's default.

## Find the profile that holds a site

List every profile's tabs and look for the site's host. Put the code in a file (see `terminal.md`, "Quoting"):

```bash
cat > tabs.js <<'EOF'
const found = await listBrowserTabs();
console.log(found.filter((t) => t.url.includes('<host>')).map((t) => t.targetId + ' ' + t.url).join('\n'));
EOF
for id in u0 u1; do echo "== $id"; aside repl --account "$id" "$(cat tabs.js)"; done   # every id `aside account list` prints
```

A tab proves the site is open there, not which account is logged in. Confirm the account the way the site skill says before you act. When a profile holds an account the user's records do not mention, tell the user.

## Skills per profile

The Aside agent loads user skills from `~/.aside/u/<n>/skills/user/`, one folder per profile number. An Aside agent started in a profile without that folder runs without these skills. Check with `ls` before you delegate with `aside exec --account <id>`.

## Dated examples (2026-09-23; not rules)

- `u0` was signed in to Aside and `u1` was not: `aside exec --account u1` refused to start, and `aside repl --account u1` worked.
- Only `u0` had a `skills/user/` folder.
- Two stores of one marketplace were logged in on `u0` and `u1`, one each.
