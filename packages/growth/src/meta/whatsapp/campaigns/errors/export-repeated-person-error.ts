/** A person export carrying the same identifier on more than one row, which the export being one
 *  row per person forbids. Each copy becomes its own account, so that person arrives, pays and
 *  commits once per copy and every published figure comes out multiplied. It is the one fault here
 *  that inflates, and nothing downstream tells it apart from a base whose people really do hold
 *  several accounts. Blank identifiers are counted on neither side. */
export class ExportRepeatedPersonError extends Error {
  readonly path: string;
  readonly rows: number;
  readonly identifiers: number;

  constructor(path: string, rows: number, identifiers: number) {
    super(
      `${rows} rows of ${path} carry a person identifier and there are only ${identifiers} distinct ` +
        "ones among them. This export is one row per person, and a repeated identifier is counted " +
        "once per row: that person's arrival, their money and their commitments are added as many " +
        "times as they appear, so every figure this run publishes comes out multiplied and the " +
        "acquisition rate with it. Nothing downstream tells that apart from a base whose people " +
        "really do hold several accounts. The export is missing a `distinct`, or it joins a table " +
        "that fans out — a wallet table above all, since a person holds one per type and currency, " +
        "which is the join the map warns at length about for the money roles. Re-export one row " +
        "per person.",
    );
    this.name = "ExportRepeatedPersonError";
    this.path = path;
    this.rows = rows;
    this.identifiers = identifiers;
  }
}
