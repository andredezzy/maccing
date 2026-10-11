/**
 * shpPullMetrics() saves a store's whole metrics snapshot into one folder of
 * the session folder: for each closed day and each window, the shop stats,
 * product overview, sales overview and Performance do Produto exports, and
 * the Shopee Ads CSV. Ads also get one file for the span from the first day
 * to the last. `references/metrics.md` names each export.
 *
 * Takes { days, windows, dir, allowDraft }:
 * - days: closed days as "YYYY-MM-DD", in GMT-03. Today is refused.
 * - windows: "past7days" and "past30days", each ending yesterday.
 * - dir: the folder, relative to the session folder. Default "metrics".
 * - allowDraft: pull a period that ends yesterday while Shopee still
 *   processes it ("Atualizando"). Without it, such a pull throws.
 *
 * Returns { done, dir, manifest }. Each manifest entry is
 * { file, bytes, sha256, export, period: { name, start, end }, draft }.
 * draft is true or false for the Informações Gerenciais exports, and null
 * for ads, which show no processing state.
 *
 * One call stops starting exports after about 30 s, so a step stays under
 * the REPL's 120 s limit. It writes manifest.json into dir after every file.
 * Call it again with the same arguments until done is true: it skips what
 * manifest.json already holds. Exports run 3.5 s apart, and a "too many
 * export requests" answer is retried.
 *
 * Needs: save-export.js, report-export.js, ads-export.js.
 */

globalThis.shpPullMetrics = async ({ days = [], windows = [], dir = "metrics", allowDraft = false } = {}) => {
  const started = Date.now();
  const dayMs = 86400000;
  // Midnight GMT-03 is 03:00 UTC.
  const midnight = (date) => {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d, 3);
  };
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const today = isoDay(Date.now() - 3 * 3600000);
  const yesterday = isoDay(midnight(today) - dayMs);

  const periods = [];
  for (const day of [...new Set(days)].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= today) {
      throw new Error(`${day} is not a closed day: give "YYYY-MM-DD" before ${today}`);
    }
    periods.push({ name: "day", start: day, end: day });
  }
  const windowDays = { past7days: 7, past30days: 30 };
  for (const name of [...new Set(windows)]) {
    if (!windowDays[name]) {
      throw new Error(`Unknown window ${name}: use ${Object.keys(windowDays).join(" or ")}`);
    }
    periods.push({ name, start: isoDay(midnight(yesterday) - (windowDays[name] - 1) * dayMs), end: yesterday });
  }

  // Shopee's own check behind the "Atualizando" label: true once yesterday's
  // figures for that page are final. Periods ending earlier are final.
  const pageTypes = {
    "shop-stats": "dashboard",
    "product-overview": "product_overview",
    "sales-overview": "sales_overview",
    "product-performance": "new_product_performance",
  };
  const ready = {};
  if (periods.some((period) => period.end === yesterday)) {
    for (const [name, pageType] of Object.entries(pageTypes)) {
      const reply = await page.evaluate(
        async (u) => (await fetch(u, { credentials: "include" })).json(),
        `/api/mydata/notice/data-ready-state/?page_type=${pageType}`,
      );
      if (reply?.code !== 0) {
        throw new Error(`No processing state for ${pageType}: ${JSON.stringify(reply).slice(0, 200)}`);
      }
      ready[name] = reply.result === true;
    }
    const pending = Object.keys(ready).filter((name) => !ready[name]);
    if (pending.length > 0 && !allowDraft) {
      throw new Error(`Shopee still processes ${yesterday} for ${pending.join(", ")}. Pull later, or pass allowDraft.`);
    }
  }

  const jobs = [];
  for (const period of periods) {
    const a = midnight(period.start) / 1000;
    const b = midnight(period.end) / 1000 + 86400;
    const p = period.name;
    const draft = (name) => period.end === yesterday && !ready[name];
    const add = (name, run, isDraft = draft(name)) => jobs.push({ export: name, period, draft: isDraft, run });
    add("shop-stats", () =>
      shpSaveExport(`/api/mydata/v6/dashboard/export/?period=${p}&start_ts=${a}&end_ts=${b}&enable_hot_listing=true`, {
        dir,
      }),
    );
    add("product-overview", () =>
      shpSaveExport(`/api/mydata/v2/product/overview/export/?period=${p}&start_ts=${a}&end_ts=${b}`, { dir }),
    );
    add("sales-overview", () =>
      shpSaveExport(`/api/mydata/v3/sales/overview/export/?start_time=${a}&end_time=${b}&period=${p}`, { dir }),
    );
    add("product-performance", () =>
      shpReportExport(
        `/api/mydata/v3/product/performance/export/?start_ts=${a}&end_ts=${b}&period=${p}&sort_by=&acc=false&`,
        {
          dir,
        },
      ),
    );
    add("ads", () => shpAdsExport(a, b, { dir }), null);
  }
  const dayList = periods.filter((period) => period.name === "day");
  if (dayList.length > 1) {
    const span = { name: "span", start: dayList[0].start, end: dayList.at(-1).end };
    jobs.push({
      export: "ads",
      period: span,
      draft: null,
      run: () => shpAdsExport(midnight(span.start) / 1000, midnight(span.end) / 1000 + 86400, { dir }),
    });
  }

  const key = (entry) => `${entry.export} ${entry.period.name} ${entry.period.start} ${entry.period.end}`;
  const manifestPath = `./${dir}/manifest.json`;
  await fs.mkdir(`./${dir}`, { recursive: true });
  const saved = (await fs.readdir(`./${dir}`)).includes("manifest.json")
    ? JSON.parse(await fs.readFile(manifestPath, "utf8"))
    : [];
  const have = new Set(saved.map(key));

  let ranOne = false;
  for (const job of jobs) {
    if (have.has(key(job))) {
      continue;
    }
    if (Date.now() - started > 30000) {
      break;
    }
    let result;
    for (let attempt = 0; ; attempt++) {
      if (ranOne) {
        await sleep(3500);
      }
      ranOne = true;
      try {
        result = await job.run();
        break;
      } catch (error) {
        if (attempt >= 3 || !/too many export requests/i.test(String(error?.message))) {
          throw error;
        }
      }
    }
    saved.push({ ...result, export: job.export, period: job.period, draft: job.draft });
    have.add(key(job));
    await fs.writeFile(manifestPath, `${JSON.stringify(saved, null, 2)}\n`);
  }

  const wanted = new Set(jobs.map(key));
  const manifest = saved.filter((entry) => wanted.has(key(entry)));
  return { done: manifest.length === jobs.length, dir, manifest };
};
