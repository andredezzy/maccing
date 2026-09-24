# Product listings

Create, edit and check listings. The rules in `SKILL.md` apply: confirm the account, read labels live, and save or publish only on the user's explicit ask.

The business side (price, stock, weight, copy, the listing record) belongs to the user. When their project declares listings, its own docs say which file holds what and how to record a publication. Ask where it is when you don't know.

## Open the form

- **New listing:** the left nav's new-product link, or the product list's add button. Either may open a small panel first. Pick the single-listing option there, not the kit. A first step asks for images, a name and GTIN. Its next-step button stays disabled until at least one image and a name are in. The full form then renders at the same URL, `/portal/product/new`. Tell the two apart by the section tabs, which only the full form has.
- **Existing listing:** `page.goto('https://seller.shopee.com.br/portal/product/<itemid>')`. The item ID is under each row of the product list.

Read the section tabs and every section's `*` labels before filling anything. The specification section hides attributes behind a show-more button. Expand it before you conclude that no attribute is required.

To learn the required fields without entering anything, read an existing listing's edit form and leave without saving. A new listing's full form cannot be seen before an image and a name are in, and it may differ from the edit form.

## Read the form

On a long form the snapshot drops sections and the tab bar, so reading values from it fails. Read the DOM instead. Each field sits in an `.edit-row` with a label; the preview card prints the name typed in the form, then the shop name. Define the helper alone in its own cell:

```js
// { fields: { '<label>': '<value>' }, preview: '<preview card text>' }.
// Labels lose their '*' and extra spaces: 'Nome do Produto', 'Preço', 'Estoque'.
globalThis.shpRead = async () => {
  const rows = await page.locator('.edit-row').evaluateAll((els) => els.map((e) => [
    (e.querySelector('[class*=label]')?.innerText ?? '').replace(/[*\s]+/g, ' ').trim(),
    [...e.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]), textarea')].map((i) => i.value).filter(Boolean).join(' | '),
  ]));
  const preview = await page.locator('.preview-card').first().innerText().catch(() => '');
  return { fields: Object.fromEntries(rows.filter(([label]) => label)), preview: preview.replace(/\s+/g, ' ') };
};
```

`console.log(JSON.stringify(await shpRead()))` prints them. The shop check is `preview.includes(fields['Nome do Produto'] + ' ' + '<shop>')`. Empty `fields` means Shopee renamed the classes: inspect the DOM before you trust any read.

## Fill by input type

Read back every value after you set it, with `inputValue()` or a snapshot. A field that reformats itself can silently keep the wrong value.

- **Images.** Put the file in the REPL session folder: `cp` with Bash inside the agent's session, or bring it in within the same call from a terminal (`../aside/references/terminal.md`). Upload one image at a time. The counter beside the add tile goes up **before** the upload ends, and a call that ends early leaves the tile stuck loading. Wait until no tile is loading:

  ```js
  const shpDone = () => page.locator('img.shopee-image-manager__image').count();
  const shpLoading = () => page.locator('.shopee-image-manager__itembox .image-loading').count();
  const shpBefore = await shpDone();
  await page.locator('input[type=file]').first().setInputFiles('./img.jpg');
  for (let i = 0; i < 40 && ((await shpDone()) <= shpBefore || (await shpLoading()) > 0); i++) await sleep(1000);
  console.log('images', shpBefore, '->', await shpDone(), 'loading', await shpLoading());
  ```

  The first tile is the cover. In edit mode, hovering a tile (`.shopee-image-manager__itembox`) reveals a delete icon (`.shopee-image-manager__icon--delete`) that deletes **with no confirmation**.
- **Video.** A separate input, `input[type=file][accept="video/mp4"]`, present only while the listing has no video. Bring the MP4 in through a local server from a terminal (`../aside/references/terminal.md`). After `setInputFiles`, an edit dialog opens with a trim bar and a confirm button: click confirm, then wait until the add-video tile is gone. The row then shows the video as processing. Shopee's own note says the listing may be saved while it processes. The video is lost if the tab closes before the save finishes: see [Save, guarded](#save-guarded). When the listing already has a video, the input is absent: nobody has replaced one yet, so ask the user before you touch the existing video.
- **Plain text** (the name): click the textbox ref, then `page.keyboard.insertText(text)`.
- **Rich text** (the description) is a `[contenteditable=true]`. Target it with `.filter({ hasText: '<text already in it>' })`, click, `Meta+A`, `Backspace`, then `page.keyboard.insertText(text)`. Each line becomes a paragraph.
- **Formatted numbers** (price, stock, weight, box sizes). Clear and type on the exact locator, never through `page.keyboard` after a click:

  ```js
  const shpInput = page.locator(ref);
  await shpInput.focus(); await page.keyboard.press('End');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await shpInput.pressSequentially('79,90'); await shpInput.blur();
  console.log(await shpInput.inputValue());
  ```

  A field may start with a value, such as stock at "0", and typing appends to it. Use a comma as the decimal separator.
- **Dropdowns** (brand, condition, attributes): see [Dropdowns and specifications](#dropdowns-and-specifications).
- **Category.** Once the name is in, recommended categories appear as clickable text. Click one, then check the category field shows its path. For any other category, click the category field. The picker that opens is not a `dialog`: find it in the snapshot's `diff` by its heading and its columns of `list`s, or by `.product-category-selector-modal` in the DOM. If the snapshot lacks it, take a screenshot. Its search box only filters the first level, so pick the rest column by column, and read the "selected" line before you confirm. **The attribute set depends on the category.** Read the specification section again after choosing.
- **Checkbox and radio labels** (no-GTIN, made-to-order): the input is hidden. Click its label ref and read `[checked]` in the next snapshot, or read the DOM: `page.locator('input[type=radio]').evaluateAll(es => es.map(e => e.closest('label')?.innerText.trim() + '=' + e.checked))`. The made-to-order control has shown as bare text with no radio on one account's form. When it is missing, say so to the user instead of assuming its value.
- **Shipping channel switch:** an `.eds-switch` (see `SKILL.md`). A form may refuse to save until at least one channel is on, even with no `*` beside it. Read its state:

  ```js
  console.log(await page.locator('.eds-switch').evaluateAll(e => e.map(x => x.className)));
  ```

## Dropdowns and specifications

A field is the ref on the line after its label. Match the label as the **end** of a text node, never its start: the first attribute's label shares one node with the section header (`"Especificação Complete: 12 / 19 … * Marca"`), and a multi-select label ends in a counter (`"Estampa 1/5"`). An open option list sits at the end of the tree as a top-level `- list:`, and it repeats the field's current value, so the option to click is the **last** match. Snapshot fresh before each lookup: opening a list re-renders the form and merges some labels.

Define the helpers alone in their own cell:

```js
globalThis.shpEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// { multi, role, shows, ref } for the field under a label, or null.
globalThis.shpField = (tree, label) => {
  const m = tree.match(new RegExp(shpEscape(label) + '( \\d+/\\d+)?"\\n\\s*- (\\w+) "([^"]*)" \\[ref=(e\\d+)\\]'));
  return m && { multi: Boolean(m[1]), role: m[2], shows: m[3], ref: m[4] };
};
globalThis.shpListOpen = (tree) => /\n- list:/.test(tree);
// Clicking the field again closes its list. Escape did not.
globalThis.shpClose = async (label) => {
  const tree = (await snapshot(page)).tree;
  if (shpListOpen(tree)) { await page.locator(shpField(tree, label).ref).click(); await sleep(600); }
};
// Opens the list, prints what it added, closes it. Reads only.
globalThis.shpOptions = async (label) => {
  const field = shpField((await snapshot(page)).tree, label);
  if (!field) return null;
  await page.locator(field.ref).click();
  await sleep(800);
  const { diff } = await snapshot(page);
  await shpClose(label);
  return diff;
};
globalThis.shpPick = async (label, option) => {
  const field = shpField((await snapshot(page)).tree, label);
  if (!field) return { ok: false, reason: 'label not found; expand the show-more button?' };
  await page.locator(field.ref).click();
  await sleep(800);
  const hits = [...(await snapshot(page)).tree.matchAll(new RegExp('generic "' + shpEscape(option) + '" \\[ref=(e\\d+)\\]', 'g'))];
  if (hits.length < (field.shows === option ? 2 : 1)) { await shpClose(label); return { ok: false, reason: 'option not listed' }; }
  await page.locator(hits.at(-1)[1]).click();
  await sleep(600);
  await shpClose(label);
  return { ok: true, now: shpField((await snapshot(page)).tree, label) };
};
```

- **Read the options** with `console.log(await shpOptions('<label>'))`.
- **Pick** with `console.log(JSON.stringify(await shpPick('<label>', '<option>')))`. Check `now.shows`. For a multi-select, call it once per value.
- **A value the list lacks.** Some lists end with an add-new item. Clicking it shows a textbox followed by a confirm button, which starts disabled and has no name. Type with `pressSequentially`: `insertText` leaves the button disabled. Then click the button on the line after the textbox, and close the list. The added value then shows under a manual-entry heading in that list.

  ```js
  // The unnamed button on the line after the add-new textbox. Refs go stale once you type.
  const shpNewItem = async () => (await snapshot(page)).tree.match(/textbox "<placeholder>" \[ref=(e\d+)\][^\n]*\n\s*- button[^\n]*\[ref=(e\d+)\]/);
  await page.locator((await shpNewItem())[1]).pressSequentially('<value>');
  await page.locator((await shpNewItem())[2]).click();
  ```
- **Textbox attributes** (quantities, sizes) take plain text: click the ref, `page.keyboard.insertText(value)`, read it back.
- **Attributes the product lacks stay empty**, even though the counter drops. `references/listing-copy.md` says why.

## Replicate a declared listing

A user's project may declare each listing once, apart from any store, in a record that holds every value the form takes. Take every value from that record, never from another store's live listing or from this skill.

1. Confirm the target store (`SKILL.md` rule 1; `../aside/references/profiles.md` for another profile).
2. Read the record: the title, description, image paths, the video path if any, price, condition, shipping, the category path and the specifications keyed by the form's labels. Stock is usually per store. If the record gives none for this store, ask the user.
3. Open a new listing ([Open the form](#open-the-form)). Upload the images in the declared order, then type the name. Add the video once the full form shows.
4. Fill field by field, as [Fill by input type](#fill-by-input-type) and [Dropdowns and specifications](#dropdowns-and-specifications) describe. A declared label the form lacks, and an option its list lacks, go to the user before you add anything.
5. Leave every attribute the declaration does not list empty.
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
// The save is done when its button leaves the page; a failed save shows the validation banner instead.
for (let i = 0; i < 30 && await page.getByRole('button', { name: shpSave, exact: true }).count(); i++) await sleep(1000);
console.log((await snapshot(page, { interactive: true })).diff);
```

`shpRead()` reads text inputs only. When the save carries an image or a video, read the image counter and the video row from a snapshot before the click, and show them to the user with the values.

Pick the button by what the user asked for: save without publishing, save and publish, or update an existing listing. If the diff shows the validation banner, follow its link to the first error, fix it, and save again.

**Keep the tab open until the save finishes**: the page leaves the edit URL, or the product list reloads. A tab closed a few seconds after the click lost an uploaded video with no warning. Then [verify](#verify) in a new call.

## Leave without saving

Navigating away from a form with nothing changed showed no prompt. With unsaved edits, assume it discards them silently: nobody has checked for a prompt there. The cancel button opens a confirm-discard modal even with nothing changed; its discard button leaves.

## Verify

After every save, open the listing's edit form again and read what Shopee kept: `shpRead()` for the values, the image counter, and the video row. Leave it without saving.

After a publish the page returns to the product list before the new listing is in it. Wait, reload in its own call, and snapshot again, until the status tab's count goes up and the listing's title shows. Its item ID is in its `/portal/product/<itemid>` link. Check its price and status, and report the ID. The public page is `https://shopee.com.br/product/<shopid>/<itemid>/`.

## Dated examples (2026-09-23; not rules)

- The validation banner read "Não é possível salvar, devido à N erros", with "Editar agora".
- Save buttons: "Salvar e Não Publicar" and "Salvar e Publicar" on a new listing. "Atualizar", "Desativar" and "Cancelar" on an existing one.
- The new-product link read "+ Novo Produto". It opened a panel, "Adicione Novo Produto", with a "Criar" button for "Listagem única" and one for "Kit". The first step's button read "Next Step".
- Sections: Informação básica, Especificação, Descrição, Informações de vendas, Informações Fiscais (optional), Envio, Outros.
- `*` labels: images and cover, name, category, brand, description, price, stock, weight, box size, condition. The form still would not save until the Correios switch was on, which carried no `*`.
- Brand "Sem marca" was the first option. Condition "Novo" sat under Outros. The made-to-order row read "Sob encomenda" with hidden "Não" and "Sim" radios. Earlier the same day, another store's form showed it as text only.
- Box inputs had placeholders "Largura", "Comprimento" and "Altura". Weight was in kg, "0,27".
- Keyboard typing into the price landed in "Comprimento". Typing into the stock field, which started at "0", appended to it and gave "100".
- The promo panel was "Produtos Padronizados Shopee", with an "Obter" button.
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
