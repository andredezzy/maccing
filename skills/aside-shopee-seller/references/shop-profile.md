# Shop profile

The shop's public name, logo, description and phone. The rules in `SKILL.md` apply: confirm the account, read labels live, and save only on the user's explicit ask.

## The password gate

The profile page (the left nav's store section, then its profile link) first asks for the shop's **login password**. The user types it, never the agent, not even when they paste it into the chat.

1. Ask the user to open the profile page in that profile's browser and unlock it.
2. Find the unlocked tab with `listBrowserTabs()` (`../aside/references/profiles.md` for another profile) and attach it by its `targetId`.
3. Work in that tab. A second tab on the same URL asked for the password again, so never open one. Assume a reload or `page.goto()` does too.

A locked tab shows the password prompt in place of the profile. An unlocked one shows the profile in view mode, with an edit button: read the body text to tell them apart before you act.

## Edit the description

The edit button turns the view into a form. Read every field before changing one. The shop name input is disabled while a rename lock is on, and a message beside it names the date the next change opens. The logo row states its size, weight and format limits.

1. Find the description textarea by its placeholder. Match a prefix, since the full text may change: `page.locator('textarea[placeholder^="Digite a descrição"]')`. Take today's placeholder from the DOM first.
2. Read the counter under it for today's limit.
3. Click the textarea, select all (`Meta+A`), `Backspace`, then `page.keyboard.insertText(text)`. From a terminal, pass the text as base64 (`../aside/references/terminal.md`).
4. Read it back with `inputValue()` and check the counter.
5. On the user's ask, show them the text read back from the page, then click the save button. Keep the tab open until view mode returns.
6. Check that view mode shows the new text.

To leave without saving, click the cancel button.

## Change the logo

The logo row lists the limits it enforces. Read them from the page before preparing a file: a file over the weight limit is refused on upload.

1. Read the logo row's size, weight and format limits.
2. Prepare the file first: resize to a few times the recommended size and save it as JPEG. An AI-generated 1536 px PNG weighed 4.1 MB. At 600 px, JPEG quality 90, it weighed 80 KB.
3. Upload it through the logo's edit control and check the preview.
4. On the user's ask, save, and check that view mode shows the new logo.

Observed on 2026-09-24: an oversized file opened a dialog, "Tamanho incorreto de imagem", with "O tamanho max. do arquivo deve ser menor que 2.0 MB" and a "Confirmar" button. Nothing was saved.

## Writing the description

The user approves the text before it goes in. `references/listing-copy.md` holds the rules shared with listings.

- **Say what the shop makes and for whom**, in plain Portuguese. The first sentence carries it.
- **Send questions to the Shopee chat.** Links, handles, phone numbers, emails and other platforms stay out, as in a listing.
- **Promise only what the shop does today**: no delivery times, guarantees or custom orders it has not committed to.
- **Name the product, not the process.** Follow the words the user's record leaves out; one set of shops left out "3D", "impressão" and similar words.
- **Stay well under the counter's limit.** A few short paragraphs read better than a full box.

## Record the change

After a save, the store's record, where the user keeps one, gets the text, the date, and the counter reading. Note a rename lock's next date there too. If the task has no access to it, give the user those facts to record.

## Dated examples (2026-09-23; not rules)

- A store in profile `u1`. The path was Loja → Perfil da loja, at `/portal/settings/shop/profile`. The gate read "Para a sua segurança, digite a sua SENHA DE LOGIN…". A second tab on the same URL asked again.
- View mode had tabs "Informação Básica" and "Verificação de Cadastro", buttons "View My Shop" and "Edit", and contact rows "Telefone" and "Segundo Telefone".
- Edit mode fields: "Nome da Loja" (disabled under a 30-day rename lock, naming the next date), "Shop Logo" (300×300 px recommended, up to 2.0 MB, JPG, JPEG or PNG), "Descrição da loja" (placeholder "Digite a descrição ou informações sobre sua loja aqui", counter 0/500), "Telefone". Buttons "Salvar" and "Cancelar".
- `insertText` into the textarea worked; after "Salvar", view mode showed the text.
