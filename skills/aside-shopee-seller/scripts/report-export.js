/**
 * shpReportExport() saves an Informações Gerenciais export that Shopee builds
 * in the background, such as Performance do Produto (parentskudetail): it asks
 * for the report, waits until it is built, then saves it.
 *
 * Takes the export URL (`references/metrics.md`). Returns what shpSaveExport()
 * returns. Throws when Shopee gives no report id, or the report is not built
 * after about 40 s.
 *
 * Needs: save-export.js.
 */

globalThis.shpReportExport = async (url) => {
  const getJson = (u) => page.evaluate(async (u) => (await fetch(u, { credentials: "include" })).json(), u);
  const asked = await getJson(url);
  const id = asked?.data?.report_id;
  if (!id) {
    throw new Error(`No report id from ${url}: ${JSON.stringify(asked).slice(0, 200)}`);
  }
  let report;
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(2000);
    report = (await getJson(`/api/v3/settings/get_report/?report_id=${id}`))?.data;
    // Status 1 is queued, 2 is built.
    if (report?.status === 2) {
      return shpSaveExport(`/api/v3/settings/download_report/?report_id=${id}`, { name: report.report_file_name });
    }
  }
  throw new Error(`Report ${id} not built: status ${report?.status}`);
};
