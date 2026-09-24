# Product listings

Create, edit and check listings. The rules in `SKILL.md` apply: confirm the account, read labels live, and save or publish only on the user's explicit ask.

The business side (price, stock, weight, copy, the listing record) belongs to the user. When their project declares listings, its own docs say which file holds what and how to record a publication. Ask where it is when you don't know.

## Open the form

- **New listing:** the left nav's new-product link, or the product list's add button. Either may open a small panel first. Pick the single-listing option there, not the kit. A first step asks for images, a name and GTIN. Its next-step button stays disabled until at least one image and a name are in. The full form then renders at the same URL, `/portal/product/new`. Tell the two apart by the section tabs, which only the full form has.
- **Existing listing:** `page.goto('https://seller.shopee.com.br/portal/product/<itemid>')`. The item ID is under each row of the product list.

**Clear the tours first.** A guided tour can sit over a new or edited form. While it is open it swallows clicks and typing, Escape does not close it, and a click meant for the form can open the category picker unseen. Run `shpDismissTours()` (`helpers.md`) after the form loads and again before typing or saving. It closes only the tours whose text you pass as known, and returns any other one for you to read.

Read the section tabs and every section's `*` labels before filling anything. The specification section hides attributes behind a show-more button. Expand it before you conclude that no attribute is required.

To learn the required fields without entering anything, read an existing listing's edit form and leave without saving. A new listing's full form cannot be seen before an image and a name are in, and it may differ from the edit form.

## Read the form

On a long form the snapshot drops sections and the tab bar, so reading values from it fails. Read the DOM instead, with the helpers in `helpers.md`:

- `shpRead()` gives the text inputs by label (`'Nome do Produto'`, `'Preço'`, `'Estoque'`) and the preview card, which prints the name typed in the form, then the shop name. The shop check is `preview.includes(fields['Nome do Produto'] + ' ' + '<shop>')`.
- `shpAttributes()` gives every specification value, `shpReadDescription('<row label>')` the description, and `shpImageSources()` the image URLs in order.

Empty results mean Shopee renamed the classes: inspect the DOM before you trust any read.

## Fill by input type

Read back every value after you set it. A field that reformats itself can silently keep the wrong value. The helpers are in `helpers.md`.

- **Images.** Put each file in the REPL session folder: `cp` with Bash inside the agent's session, or bring it in from a terminal (`../aside/references/terminal.md`). `shpUploadImage('./img.jpg')` adds one image at the end and waits until it has finished; upload them one at a time, in the declared order. The first image is the cover. The edit form holds several file inputs, and only the one inside `.shopee-image-manager` takes images; that input accepts several files, but whether it keeps their order has not been checked.
- **Replacing images.** `shpDeleteImage(0)` deletes the cover **with no confirmation**, and the next image moves up. To replace them all, delete position 0 until none is left, then upload the new ones. Every step of a replacement, and the save, must run in one tab that stays open: all in one call from a terminal, or as separate steps of a session that outlives the call (`../aside/references/terminal.md`). A tab closed between the deletes and the save loses the change.
- **Video.** A separate input, `input[type=file][accept="video/mp4"]`, present only while the listing has no video. Bring the MP4 in through a local server from a terminal (`../aside/references/terminal.md`). After `setInputFiles`, an edit dialog opens with a trim bar and a confirm button: click confirm, then wait until the add-video tile is gone. The row then shows the video as processing. Shopee's own note says the listing may be saved while it processes. The video is lost if the tab closes before the save finishes: see [Save, guarded](#save-guarded). When the listing already has a video, the input is absent: nobody has replaced one yet, so ask the user before you touch the existing video.
- **Name, numbers and textbox attributes** (price, stock, weight, box sizes, quantities): `shpTypeInto(<input locator>, '<value>')`. It types on the input itself and returns what the input holds. `fill()` throws on the formatted inputs, `page.keyboard.insertText` has left the name unchanged and appended to a quantity, and keyboard typing after a click has landed in another field. Use a comma as the decimal separator.
- **Description** is a Quill editor: `shpTypeDescription('<row label>', text)` types it line by line and returns whether it reads back exactly. Target the `.ql-editor` in the description row, never a bare `[contenteditable]`: a hidden `.ql-clipboard` matches too.
- **Dropdowns** (brand, condition, attributes): see [Dropdowns and specifications](#dropdowns-and-specifications).
- **Category.** Once the name is in, recommended categories appear as clickable text. The form may not select one on its own: click the one you want, then check the category field shows its path. For any other category, click the category field. The picker that opens is not a `dialog`: find it in the snapshot's `diff` by its heading and its columns of `list`s, or by `.product-category-selector-modal` in the DOM. If the snapshot lacks it, take a screenshot. Its search box only filters the first level, so pick the rest column by column, and read the "selected" line before you confirm. **The attribute set depends on the category.** Read the specification section again after choosing. A stray click can open the picker where the snapshot does not show it: `shpCloseCategoryPicker('<cancel label>')` closes it.
- **Checkbox and radio labels** (no-GTIN, made-to-order): the input is hidden. Click its label ref and read `[checked]` in the next snapshot, or read the DOM: `page.locator('input[type=radio]').evaluateAll(es => es.map(e => e.closest('label')?.innerText.trim() + '=' + e.checked))`. The made-to-order control has shown as bare text with no radio on some forms. When it is missing, say so to the user instead of assuming its value.
- **Shipping channel switch:** an `.eds-switch` (see `SKILL.md`). A form may refuse to save until at least one channel is on, even with no `*` beside it. Read its state:

  ```js
  console.log(await page.locator('.eds-switch').evaluateAll(e => e.map(x => x.className)));
  ```

## Dropdowns and specifications

A field is the ref on the line after its label. `shpField()` matches the label as the **end** of a text node: the first attribute's label shares one node with the section header (`"Especificação Complete: 12 / 19 … * Marca"`), and a multi-select label ends in a counter (`"Estampa 1/5"`). An open option list sits at the end of the tree as a top-level `- list:`, and it repeats the field's current value, so `shpPick()` clicks the **last** match. Snapshot fresh before each lookup: opening a list re-renders the form and merges some labels.

- **Read the options** with `console.log(await shpOptions('<label>'))`.
- **Pick** with `console.log(JSON.stringify(await shpPick('<label>', '<option>')))`. Check `now.shows`. For a multi-select, call it once per value.
- **A value the list lacks.** Some lists end with an add-new item. `shpAddItem('<label>', '<value>', { addItem: '<its text>', input: '<its textbox placeholder>' })` adds the value and selects it. The value then shows under a manual-entry heading in that list. Adding a value is still a declared value: add only what the listing declares.
- **A field can change type with the category.** The same label has been a textbox in one category and a dropdown in another. Read `shpField(...).role` and use `shpTypeInto` for a textbox, `shpPick` for a dropdown.
- **Pre-filled values.** Shopee can fill attributes on its own when the category is chosen, under a pre-filled notice. Read them all with `shpAttributes()` and clear every value the listing does not declare with `shpClearAttribute('<label>')`. Clear with that helper, not by opening the field: clicking a multi-select can remove a tag you meant to keep.
- **Attributes the product lacks stay empty**, even though the counter drops. `references/listing-copy.md` says why.

## Replicate a declared listing

A user's project may declare each listing once, apart from any store, in a record that holds every value the form takes. Take every value from that record, never from another store's live listing or from this skill.

1. Confirm the target store (`SKILL.md` rule 1; `../aside/references/profiles.md` for another profile).
2. Read the record: the title, description, image paths, the video path if any, price, condition, shipping, the category path and the specifications keyed by the form's labels. Stock is usually per store. If the record gives none for this store, ask the user.
3. Open a new listing ([Open the form](#open-the-form)) and clear the tours. Upload the images in the declared order, then type the name. Add the video once the full form shows. A cover Shopee flagged on another store's copy of this listing does not go up again (`references/diagnostics.md`, "Fixing a failed image criterion").
4. Fill field by field, as [Fill by input type](#fill-by-input-type) and [Dropdowns and specifications](#dropdowns-and-specifications) describe. A declared label the form lacks, and an option its list lacks, go to the user before you add anything.
5. Leave every attribute the declaration does not list empty, including those Shopee pre-filled: read `shpAttributes()` before the save and compare it with the declaration.
6. Save only on the user's ask ([Save, guarded](#save-guarded)), then [verify](#verify). Record the publication where the user's project says.

## Save, guarded

Only on the user's explicit ask. Keep the checks and the click in one cell, so nothing changes between them. Set the constants from your last snapshot, the store's record and the values the user confirmed:

```js
const shpAccount = '<header username>';                  // the header username you confirmed
const shpShop = '<shop name>';                            // the shop name from the store's record
const shpSave = 'Salvar e Não Publicar';                  // today's label of the button the user asked for
const shpExpect = { 'Preço': '79,90', 'Estoque': '10' };  // shpRead's label → the confirmed value
if (!(await snapshot(page)).tree.includes('"' + shpAccount + '"')) throw new Error('another account is logged in');
const { fields, preview } = await shpRead();
if (!preview.includes(fields['Nome do Produto'] + ' ' + shpShop)) throw new Error('the preview does not show shop ' + shpShop);
for (const [label, want] of Object.entries(shpExpect)) {
  if (fields[label] !== want) throw new Error(label + ' reads ' + fields[label] + ', expected ' + want);
}
await page.getByRole('button', { name: shpSave, exact: true }).click();
// The click went through when its button leaves the page; a failed save shows the validation banner instead.
for (let i = 0; i < 30 && await page.getByRole('button', { name: shpSave, exact: true }).count(); i++) await sleep(1000);
console.log((await listBrowserTabs()).find((t) => t.targetId === page.targetId)?.url);
console.log((await snapshot(page, { interactive: true })).diff);
```

Before this cell, clear the tours and any stray category picker (`shpDismissTours`, `shpCloseCategoryPicker`). `shpRead()` reads text inputs only. When the save carries images or a video, add their checks to the cell: the image count (`(await shpImageSources()).length`), no tile still loading (`page.locator('.shopee-image-manager .image-loading').count()` is 0), and the video row. Show them to the user with the values.

Pick the button by what the user asked for: save without publishing, save and publish, or update an existing listing. If the diff shows the validation banner, follow its link to the first error, fix it, and save again.

**The button leaving is not proof the save landed.** After an update, the page may stay on the edit URL, and the button can vanish within about 2 s. Keep the tab open a few more seconds, then [verify](#verify) by opening the listing again. With a video, keep the tab open until the page leaves the edit URL or the product list reloads: a tab closed a few seconds after the click lost an uploaded video with no warning.

## Leave without saving

Navigating away from a form with nothing changed showed no prompt. With unsaved edits, assume it discards them silently: nobody has checked for a prompt there. The cancel button opens a confirm-discard modal even with nothing changed; its discard button leaves.

## Verify

After every save, open the listing's edit form again, in a fresh load, and read what Shopee kept: `shpRead()` for the values, `shpReadDescription()`, `shpAttributes()`, and the video row. A form read in the same tab right after the save can show stale values: reload before you trust it.

**Image order.** A count proves nothing about which image is where. Print `JSON.stringify(await shpImageSources())`, then compare those URLs with the declared files in the shell:

```bash
bun <skill dir>/scripts/image-order.ts <declared file>... -- <live URL>...
```

It prints the nearest file per position and exits 1 when a position holds the wrong file, an unsure match, or the counts differ. It compares against every image in the declared files' folders, so a sibling photo uploaded by mistake is named.

After a publish the page returns to the product list before the new listing is in it. Wait, reload in its own call, and snapshot again, until the status tab's count goes up and the listing's title shows. Its item ID is in its `/portal/product/<itemid>` link. Check its status there, and its price in the edit form: a product list row can leave the price out of its text. Report the ID. The public page is `https://shopee.com.br/product/<shopid>/<itemid>/`.

## Dated examples (2026-09-23 and 2026-09-24; not rules)

- The validation banner read "Não é possível salvar, devido à N erros", with "Editar agora".
- Save buttons: "Salvar e Não Publicar" and "Salvar e Publicar" on a new listing. "Atualizar", "Desativar" and "Cancelar" on an existing one.
- The new-product link read "+ Novo Produto". It opened a panel, "Adicione Novo Produto", with a "Criar" button for "Listagem única" and one for "Kit". The first step's button read "Next Step".
- Sections: Informação básica, Especificação, Descrição, Informações de vendas, Informações Fiscais (optional), Envio, Outros.
- `*` labels: images and cover, name, category, brand, description, price, stock, weight, box size, condition. The form still would not save until the Correios switch was on, which carried no `*`.
- Brand "Sem marca" was the first option. Condition "Novo" sat under Outros. The made-to-order row read "Sob encomenda" with hidden "Não" and "Sim" radios. Earlier the same day, another store's form showed it as text only.
- Box inputs had placeholders "Largura", "Comprimento" and "Altura". Weight was in kg, "0,27".
- Keyboard typing into the price landed in "Comprimento". Typing into the stock field, which started at "0", appended to it and gave "100".
- The promo panel was "Produtos Padronizados Shopee", with an "Obter" button.
- 2026-09-24, on three stores: two guided tours covered the new and edit forms. "Produtos Padronizados" sat in `.tour-container`, with an "Obter" button carrying `.next-button`; "Impulsione seus anúncios…" sat in `.step-container`, with `.next-button`. Clicking `.next-button` closed each. Escape closed neither. While one was open, typing went nowhere, and one click opened the "Editar Categoria" picker, which the snapshot did not show; its visible "Cancel" button, clicked by mouse position, closed it.
- 2026-09-24: the edit form held four `input[type=file]`; the image manager's one had `multiple`. Deleting and uploading 5 to 7 images and saving took 30 to 43 s in one call. Matching a tile with `filter({ has: 'img[src*=<id>]' })` missed; `.nth(i)` worked.
- 2026-09-24: `page.keyboard.insertText` left the name and description unchanged with no error, and appended to "Quantidade da embalagem". `pressSequentially` on the input worked; the description took `keyboard.type` line by line, with Enter.
- 2026-09-24: replacing every image by deleting position 0 until none was left, then uploading the new set, saved fine with "Atualizar"; the form did not object to zero images in between. The live image URLs (`down-br.img.susercontent.com`) downloaded without a login.
- 2026-09-24: the new form's name input had a placeholder starting "Nome da marca"; the description row read "Descrição do produto".
- 2026-09-24: clicking "Obter" on the "Produtos Padronizados" tour closed it. Whether it also enrolled the listing in anything was not checked.
- 2026-09-24: the recommended category showed but was not selected on some new forms until clicked.
- 2026-09-24, "Artigos Religiosos e de Fengshui": Shopee pre-filled attributes under "Atributos pré-preenchidos", such as a Material the listing did not declare. Material had no "Plástico", added with "Adicionar um novo item". "Quantidade por Pacote" was a dropdown there, a textbox in another category. "Sob encomenda" showed as text only on one store.
- 2026-09-24: after "Atualizar", the page stayed on the edit URL and the button was gone within about 2 s. A reopened form showed the new values; a form read in the same tab right after a publish showed stale ones.
- 2026-09-24: image-order.ts put the right file at 0.0 to 1.7 and the next nearest at 4.7 or more; two views of the same statue were the closest pair.
- The commission policy article sat at https://seller.br.shopee.cn/edu/article/26839.
- A second store, in profile `u1`, had a header username Shopee generated, unrelated to the shop name. Its preview line ended in the shop name, after the product name.
- The specification header and the brand label shared one node: "Especificação Complete: 12 / 19 Preencha mais atributos … * Marca". The show-more button read "Exibir mais", then "Ver Menos".
- The Tema list held a search box, "Música", a "Opção de preenchimento manual" heading over the added "Arte", and "Adicionar um novo item". The add-new textbox's placeholder read "Inserir". "Arte" (Tema) and "Escultura" (Subject) were added that way. Escape left both a single- and a multi-select list open; clicking the field closed them.
- Attributes left empty because the statue lacks them: "Tapestry Type", "Plaque/Sign Type", "Tamanho Do Pacote" (in mL) and "Instruções de cuidados".
- The cancel modal read "Confirmar Descartar mudanças?" with "Cancelar" and "Descartar".
- After "Salvar e Publicar", a reload 10 to 25 s later showed "Ativo(1)" and the new listing's link.
- `shpRead()` read "Nome do Produto", "Preço" 79,90, "Estoque" and "Peso (ex: 0,4 kg)" 0,27 on both stores' listings, before and after scrolling to the bottom. After that scroll the section tab bar was gone from the snapshot.
- Image tiles showed `.image-loading` while uploading; the counter read "Adicionar Imagem (n/9)".
- The video row read "Vídeo do Produto", with limits "Max 30MB", "Duração: 10s-60s", "Formato: MP4". The trim dialog read "Editar Vídeo" with "Confirmar"; the row then showed "Processando". Closing the tab about 6 s after "Atualizar" lost the video; waiting about 12 s, until the page left the edit URL, kept it.
- The category picker's heading read "Editar Categoria", with a search box "Insira ao menos 1 caracteres", a "Categoria selecionada: …" line, and "Cancel" and "Confirm". Searching "Religio" listed only "Casa e Decoração".
- Religious figurines went in "Casa e Decoração > Artigos Religiosos e de Fengshui". Its attributes included "Religião" and lacked Estilo, Estampa, Tema and Decoração Sazonal, which "Casa e Decoração > Decoração > Outros" had.
- The edit form's DOM held a hidden modal, "Nominate this product for the Cheapest on Shopee program?", with "No, Just Update". Nobody has seen it open.
