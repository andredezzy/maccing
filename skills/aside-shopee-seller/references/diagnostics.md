# Product diagnostics

Which listings Shopee holds back, and which quality task each one fails. Reading is safe. Fixing a listing is an edit, so `SKILL.md` rule 2 applies.

## Read the product list's diagnosis

The product list's live tab has a diagnosis column. Each row states the listing's recent sales and impressions and a traffic status for new items: a boost, or blocked with an adjust link beside it. Read the rows from the DOM, one per item ID:

```js
// { '<itemid>': '<row text>' }. The status is at the end of each row.
const shpRows = await page.locator('a[href*="/portal/product/"]').evaluateAll((as) => {
  const out = {};
  for (const a of as) {
    const id = a.getAttribute('href').match(/\/portal\/product\/(\d+)/)?.[1];
    if (id && !out[id]) out[id] = (a.closest('tr, [class*=row]')?.innerText ?? '').replace(/\s+/g, ' ').trim();
  }
  return out;
});
console.log(JSON.stringify(shpRows, null, 1));
```

An empty row text means Shopee renamed the row classes: take a screenshot and inspect the DOM before trusting the read. When the list has more than one page, read each one before saying no other listing is blocked. Someone may be fixing listings while you read: read the list again just before you report.

## Read one listing's tasks

Open the listing's edit form (`/portal/product/<itemid>`) and read the product optimiser panel on its left. It groups tasks by tier. The basic tier needs every image, title and description criterion, and the panel header says how many days the new-item window has left. Read that number live.

The panel shows pass or fail **only as an icon**. `innerText` lists the criteria without their state. The icon's class carries it:

```js
// The panel's whole text (tier, days left, group counters), then each rendered criterion as 'pass …' or 'FAIL …'.
console.log(JSON.stringify(await page.locator('.quality-card').first().evaluate((card) => ({
  text: card.innerText.replace(/\s+/g, ' '),
  criteria: [...card.querySelectorAll('.mertic-item')].map((m) => (m.querySelector('.icon-finished') ? 'pass ' : 'FAIL ') + m.innerText.trim()),
}))));
```

Only an expanded group renders its criteria, and the panel expands a failing group on its own. The group counters ("n / m") in `text` cover the rest. The video task sits in the top tier and does not block basic traffic, so `criteria` holding only the video means the basic tier passes; the product list's status confirms it. If `criteria` comes back empty, or its classes are gone, take a screenshot with `page.screenshot()` and read the icons: a filled check passes, a grey one fails. `locator.screenshot()` has failed there with "Invalid parameters".

The adjust link in the product list opens the same edit form in a **new popup tab**. Opening the edit URL yourself inside one call avoids that. If a popup did open, list the tabs and close it when done.

## Fixing a failed image criterion

The fix belongs to the user's listing record. Propose it and change the listing only on their ask (`references/listings.md`).

Inference from two dated cases, not a Shopee rule: the sharpness check weighs the cover most, and a low-contrast cover reads as soft. Upscaled photos padded with a blurred copy of themselves failed it.

1. Try a sharp, higher-contrast cover first. Move soft images to the end.
2. Keep the original resolution, pad with a plain background, and judge sharpness at 100 % zoom.
3. After the save, re-read the panel with the icon-class script above.

## Dated examples (2026-09-23; not rules)

- A store in profile `u1`, product list at `/portal/product/list/live/all`. Column "Diagnóstico do Produto". Row endings read "0 Vendas (30 Dias) 0 Impressões (30 Dias) 0 Aumento De Tráfego Para Novo Item (90 Dias)", or "… Tráfego Bloqueado Para Novo Item (90 Dias) Ajustar". "Ajustar" opened the edit form in a popup with `?pageEntry=product_list`.
- The panel read "Otimizador de Produtos", "Para itens criados há até 90 dias, conclua todas as tarefas qualificadas para obter tráfego básico: faltam 90 dias". Tiers "Qualificado" (Imagem n / 5, Título n / 4, Descrição n / 1) and "Excelente" (Enviar vídeo). The image criteria: "Envie pelo menos 2 imagens", "Tamanho ajustado mostrando o produto completo, sem bordas/margens brancas", "Envie imagens nítidas", "Garanta um fundo limpo", "Nenhuma marca d’água cobrindo o produto". A passing icon carried `icon-finished`.
- At first read, two of ten listings were blocked, both on "Envie imagens nítidas" (Imagem 4 / 5). Their photos were the author's 1000 px originals, upscaled to 1500 px and padded with a blurred copy of the photo. Similar listings with sharper covers passed.
- How those two cleared. One (a figurine of Jesus) cleared at once when a sharp generated scene became the cover and the enlarged, blur-padded author photos moved to the end. The other (a Cristo Redentor statue) did not clear with the same move, nor after two more author photos were dropped. It cleared only when the cover changed from a white statue on a white studio background to a higher-contrast scene in warm altar light.
