# Metrics and exports

Reading a store's numbers: Informações Gerenciais (the shop's traffic, sales and per-listing figures), Shopee Ads, the notices count, and saving Shopee's export files. Everything here is read-only. The rules in `SKILL.md` still apply: confirm the account first.

## Where the numbers live

| Numbers | Page | Export |
|---|---|---|
| Shop stats: visitors, clicks, orders, sales, conversion | Informações Gerenciais → Visão Geral (`/datacenter/overview`) | shop stats `.xlsx` |
| Product overview | Informações Gerenciais → Produto → Visão Geral do Produto | product overview `.xlsx` |
| Per-listing impressions, clicks, CTR, carts, orders | Informações Gerenciais → Produto → Performance do Produto | `parentskudetail.<start>_<end>.xlsx`, built in the background |
| Sales overview | Informações Gerenciais → Vendas | sales overview `.xlsx` |
| Ads: credit, spend, each ad's figures | Central de Marketing → Shopee Ads (`/portal/marketing/pas/index`) | "Dados Gerais de Anúncios" `.csv` |
| Unread notices | the bell in the header | none: read the count (below) |

Each page's "Exportar dados" button calls one of the endpoints below. Snapshot the page for today's labels and period picker.

## Save exports by fetch, not by download

A click on "Exportar dados" or "Baixar" saves into `~/Downloads`, outside the session folder, and some buttons fire no `download` event at all. Fetch the export inside the page instead: the page's login goes with the request, and the file lands in the session folder. Then copy it out with the shell (`../aside/references/terminal.md`, "Getting a file out") and check its SHA-256 against the one the helper returns.

Load these helpers (`references/helpers.md`) and call them with `page` on a Seller Centre tab:

| Export | Call |
|---|---|
| Shop stats | `shpSaveExport(\`/api/mydata/v6/dashboard/export/?period=${p}&start_ts=${a}&end_ts=${b}&enable_hot_listing=true\`)` |
| Product overview | `shpSaveExport(\`/api/mydata/v2/product/overview/export/?period=${p}&start_ts=${a}&end_ts=${b}\`)` |
| Sales overview | `shpSaveExport(\`/api/mydata/v3/sales/overview/export/?start_time=${a}&end_time=${b}&period=${p}\`)` |
| Performance do Produto | `shpReportExport(\`/api/mydata/v3/product/performance/export/?start_ts=${a}&end_ts=${b}&period=${p}&sort_by=&acc=false&\`)` |
| Shopee Ads | `shpAdsExport(a, b)`, one period per REPL step |

Each returns `{ file, bytes, sha256 }`, and the file keeps Shopee's own name. The ads names hold the dates with slashes; the helper writes each `/` as `_`, as the browser does. Shopee may move these endpoints. When one fails, open the page, click "Exportar dados" once with a request log running, and read the URL it calls.

### Periods

`a` and `b` are Unix seconds: `a` is midnight GMT-03 of the first day, and `b` is midnight after the last day. For 10/10/2026, `a = Date.UTC(2026, 9, 10, 3) / 1000` and `b = a + 86400`.

| `p` | Covers |
|---|---|
| `day` | one closed day |
| `yesterday` | yesterday |
| `past7days` | the 7 days ending yesterday: `a` is midnight 6 days before yesterday, `b` is midnight after yesterday |
| `past30days` | the 30 days ending yesterday: `a` is midnight 29 days before yesterday |

Informações Gerenciais offers no custom period. For a span such as 08/10 to 10/10, export each day and add the figures that add up (visitors, orders, sales; never a rate). Shopee Ads takes any span.

## When the figures are final

The period picker labels a period still being processed "Atualizando", and today's view names the hour it has processed up to ("Até 17:00"). Read the label: a figure read under "Atualizando" is a draft, and a record of it says so.

Dated observation (2026-10-02 and 2026-10-03, not a rule): yesterday's figures read "Atualizando" until about 09:00 GMT-03, and the 7-day views until about 10:00.

## Notices

Opening the bell marks every notice read, and the owner loses the unread signal (2026-10-03). Count them without opening it: `fetch('/api/v2/notification/unread_count')` inside the page returns `has_unread` and per-folder counts. Open the bell only when the user asks to read the notices.

## Dated examples (2026-10-11; not rules)

- A store on profile `u1`: one call of each helper for 10/10 saved `<username>.shopee-shop-stats.20261010-20261010.xlsx`, `productoverview20261010-20261010.xlsx`, `sales_overview_20261010-20261010.xlsx` and `parentskudetail.20261010_20261010.xlsx`. Two ads exports saved `Dados+Gerais+de+Anúncios+Shopee-10_10_2026-10_10_2026.csv` and `…-08_10_2026-10_10_2026.csv`. Every SHA-256 on disk matched the helper's.
- Ads export jobs started back to back answered `{"code":200,"msg":"too many export requests"}`. Waiting 3 to 4 s between tries got each through.
- Performance do Produto's report went from status 1 (queued) to 2 (built) within about 4 s.
