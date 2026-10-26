/**
 * shpSaveExport() fetches one export inside the page, with the page's login,
 * and writes it to a folder inside the session folder, `exports/` unless
 * told otherwise. Nothing lands in ~/Downloads.
 *
 * Takes the export's URL and, optionally, { method, body, name, dir }. method
 * and body make a POST with a JSON body. name is used only when the reply names
 * no file. dir is the folder, relative to the session folder. Returns
 * { file, bytes, sha256 }, where file is relative to the session folder.
 * Throws when the reply is not a file.
 *
 * Shopee's ads file names hold slashes ("…Shopee-08/10/2026-08/10/2026.csv").
 * Each "/" becomes "_", as in the browser's own download.
 *
 * Needs: no other helper.
 */

globalThis.shpSaveExport = async (url, { method, body, name, dir = "exports" } = {}) => {
  const reply = await page.evaluate(
    async ([url, method, body]) => {
      const init = { credentials: "include" };
      if (method) {
        Object.assign(init, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      }
      const res = await fetch(url, init);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return {
        status: res.status,
        type: res.headers.get("content-type") ?? "",
        disposition: res.headers.get("content-disposition") ?? "",
        base64: btoa(binary),
        sha256: [...digest].map((b) => b.toString(16).padStart(2, "0")).join(""),
      };
    },
    [url, method, body],
  );
  const encoded = reply.disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = reply.disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = encoded ? decodeURIComponent(encoded) : (plain ?? name);
  if (reply.status !== 200 || reply.type.includes("json") || !fileName) {
    const text = Buffer.from(reply.base64, "base64").toString("utf8").slice(0, 200);
    throw new Error(`No file from ${url}: ${reply.status} ${reply.type} ${text}`);
  }
  const file = `${dir}/${fileName.split("/").join("_")}`;
  const bytes = Buffer.from(reply.base64, "base64");
  await fs.mkdir(`./${dir}`, { recursive: true });
  await fs.writeFile(`./${file}`, bytes);
  return { file, bytes: bytes.length, sha256: reply.sha256 };
};
