/** A bound amount column that is empty on a row, or holding something that is not a number. The
 *  two have different fixes, so the message names which one happened. A column absent from the
 *  file is `ExportColumnError` instead, checked against the header before any row is read. */
export class ExportValueError extends Error {
  constructor(path: string, column: string, raw: string) {
    const found =
      raw.trim() === ""
        ? "is empty on one row, and an amount nobody wrote is not an amount of zero — fill the row " +
          "at the source, or narrow the export to the rows that carry a value"
        : `holds ${JSON.stringify(raw)}, which is not a number — look for a currency symbol, a ` +
          "thousands separator, or a decimal comma the export left in";
    super(
      `${path} column ${JSON.stringify(column)} ${found}. Treating it as zero would quietly shrink a ` +
        "total that someone will publish.",
    );
    this.name = "ExportValueError";
  }
}
