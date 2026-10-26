# Attributes in bulk

Set specification attributes on many listings from one page, the attributes tool. The rules in `SKILL.md` apply: confirm the account, read labels live, and save only on the user's explicit ask. Every value comes from the user's declaration, as in `listings.md`.

## Find it

The product list's bulk-actions menu opens it. The page lists items in two tabs, published and unpublished, with each item's attribute fields inline. Read both tabs before you say an item is missing.

The bulk-edit templates on the same menu carry no attributes. Attributes change here or in each listing's form.

## Fill

- **Only the category's own attributes show.** A field absent from an item's row does not exist for that category. It is not hidden. Report it to the user; do not go looking for it in another tool.
- **Read each field's options live.** A dropdown's options belong to its category.
- **The apply-to-category prompt.** Choosing a value on one item offers to apply it to every product of the same category on the page. Answer yes only when every one of those products declares that value. Otherwise answer no and set each item on its own.

## Save

The save-all button opens a confirm dialog. Show the user the values first, as `SKILL.md` rule 2 says.

**Expect a captcha.** A save through `aside repl` has led to a puzzle captcha every time so far. Only the owner solves it. Before the click, tell the user a captcha may come, so they are at the screen. Whether or not it is solved, reload the page and read back every value you set: a captcha that timed out still let the save through.

**Keep each batch small.** The page is heavy. Save after a few edits instead of piling up changes: a tab has crashed with many unsaved edits on it, and they were lost. With cua-driver, first filter the page to one item with its search (`SKILL.md`, "How the Seller Centre behaves in Aside").

## Dated examples (2026-09-27; not rules)

- On Drimo, the path was "Meus produtos" → "Ações em Massa" → "Ferramenta dos Atributos". The page heading read "Ferramenta de características", with tabs "Itens Publicados" and "Itens Não Publicados". Saving took "Salvar todos", then "Confirmar".
- The apply-to-category prompt answered "Sim" or "Não".
- Chaveiros had no Material and no Duração da Garantia field. Tipo de Garantia offered Garantia Internacional, Garantia do Fabricante, Garantia do Fornecedor and Sem Garantia.
- The "Editar em Massa" templates were Informações básicas, vendas, envio, prazo, mídia, fiscais, Anatel, compatibilidade and Anvisa. None held attributes.
- Both "Salvar todos" clicks made through `aside repl` led to a "Verifique para continuar" puzzle, even with 5 to 10 s pauses between steps. The first timed out ("tempo esgotado") before the owner could solve it, and the save had still gone through. After the owner solved the second, the save had persisted.
- A Chromium tab on this page crashed with "Aw, Snap!" (code 5) after many unsaved edits.
