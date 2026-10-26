# The password gate

Finanças (Minha Renda, `/portal/finance/income`) and the shop profile page first ask for the shop's login password. The agent fills it from the user's password manager, through a one-time local hand-off, so the secret never enters a command line, a log or the transcript. When the user would rather type it, take the fallback at the end.

The hand-off has run on Minha Renda only. For the shop profile page, swap the URL in step 2 and read the result the same way.

## Before you start

- **The user's 1Password item for the store.** Find it with `2password find "<store or site name>"`, which prints references, never values. The user may keep each store's item id in a record or memory: use that. Pick by the store's username; when two items could fit, ask.
- **Use the item id in the reference**: `op://<vault>/<item id>/password`. `op` rejects a reference whose item title holds `(`, such as "Shopee Brasil (Store)".
- **Check the store on the Seller Centre home first**, in the same REPL call. The gate page shows no username, so it cannot tell you which store you are unlocking.
- **A login page, a 2FA prompt or a robot check** instead of the gate: close your tab and stop. Tell the user; never solve one.

## Fill it

1. Start the hand-off in the background, with a fresh token. Pick a free port when another agent may run one too:

   ```bash
   TOKEN=$(openssl rand -hex 16); PORT=18979
   (TOKEN=$TOKEN PORT=$PORT 2password run --env "SECRET=op://<vault>/<item id>/password" -- bun <skill dir>/scripts/serve-once.ts >/dev/null 2>&1 &)
   sleep 8   # 2password may wait on 1Password's unlock
   ```

   [`serve-once.ts`](../scripts/serve-once.ts) answers one request on `127.0.0.1:<PORT>/<TOKEN>` with the secret, then exits. It exits on its own after 110 s.
2. Save this step as `gate.tmpl.js`, fill in the token and port (`sed -e "s/__TOKEN__/$TOKEN/" -e "s/__PORT__/$PORT/" gate.tmpl.js > gate.js`), and run `gate.js` as one REPL step:

   ```js
   page = myTab;
   await page.goto("https://seller.shopee.com.br/");
   await sleep(4000);
   if (!(await page.evaluate(() => document.body.innerText)).includes("<store username>")) throw new Error("wrong store");
   await page.goto("https://seller.shopee.com.br/portal/finance/income");
   await sleep(6000);
   const input = page.locator('input[type="password"]');
   if ((await input.count()) === 1) {
     await input.fill(await (await fetch("http://127.0.0.1:__PORT__/__TOKEN__")).text());
     await page.locator("button", { hasText: "Verificar" }).first().click();
     await sleep(6000);
   }
   console.log("gate still shown:", (await page.locator('input[type="password"]').count()) > 0);
   ```
3. Delete the step file that held the token, and check the hand-off is gone: `pgrep -fl serve-once.ts || echo gone`. Stop it with `pkill -f serve-once.ts` if it still runs.

The secret goes only from `fetch()` into `fill()`. Never print it, log it, or read it with `2password read` or `op read`. The unlock held into the next REPL calls of the same tab.

## What stays the owner's

- **Saldo da Carteira** asks to create a wallet PIN before it shows the wallet. Creating one is a setting: record the wallet as "not read" unless the page shows its balance without it.
- **Contas Bancárias** asks for the password again. Leave it: a bank account is the owner's to see and change.

## Fallback: the user types it

1. Ask the user to open the page in that profile's browser and unlock it.
2. Find the unlocked tab with `listBrowserTabs()` (`../maccing-aside/references/profiles.md` for another profile) and attach it by its `targetId`.
3. Work in that tab. A second tab on the same URL asked for the password again, and so may a reload or `page.goto()`.

A locked tab shows the password prompt in place of the page; read the body text to tell them apart before you act.

## Dated examples (not rules)

- 2026-10-08 and 2026-10-11: the hand-off unlocked Minha Renda for two stores on two profiles, each with its own port. After "Verificar" the password input was gone, and `serve-once.ts` had exited.
- 2026-10-08: in a one-shot `aside repl` call, Aside Vault's `passwordManager` global was missing, and the 1Password extension in Aside was locked. That is why the hand-off runs outside Aside.
- 2026-09-23: the shop profile gate read "Para a sua segurança, digite a sua SENHA DE LOGIN…".
