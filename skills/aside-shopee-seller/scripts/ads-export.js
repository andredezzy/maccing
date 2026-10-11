/**
 * shpAdsExport() saves the Shopee Ads "Dados Gerais de Anúncios" CSV for one
 * period: it starts an export job, waits for it, and saves the file.
 *
 * Takes the period's start and end as Unix seconds: midnight GMT-03 of the
 * first day, and midnight after the last day. Returns what shpSaveExport()
 * returns. Shopee answers "too many export requests" to jobs started close
 * together, so it retries for about 30 s. Run one period per REPL step.
 *
 * Needs: save-export.js.
 */

globalThis.shpAdsExport = async (startTs, endTs) => {
  const post = (url, body) =>
    page.evaluate(
      async ([url, body]) =>
        (
          await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        ).json(),
      [url, body],
    );
  let started;
  for (let attempt = 0; attempt < 8; attempt++) {
    started = await post("/api/pas/v1/report/export_job/trigger/", {
      language: "pt-BR",
      report_type: "product_homepage_v2__overall",
      start_time: startTs,
      end_time: endTs - 1,
    });
    if (started?.data?.export_id) {
      break;
    }
    await sleep(4000);
  }
  const id = started?.data?.export_id;
  if (!id) {
    throw new Error(`No ads export started: ${JSON.stringify(started).slice(0, 200)}`);
  }
  let job;
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    job = (await post("/api/pas/v1/report/export_job/get_single_result/", { export_id: id }))?.data;
    if (job?.status === "success") {
      const link = await post("/api/pas/v1/report/export_job/get_download_url/", { export_id: id });
      return shpSaveExport(link.data.download_url);
    }
  }
  throw new Error(`Ads export ${id} not ready: ${job?.status}`);
};
