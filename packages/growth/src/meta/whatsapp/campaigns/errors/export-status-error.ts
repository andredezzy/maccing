/**
 * A conversion role with rows, not one of which is marked committed.
 *
 * The committed predicate lives in the source's own query, so a value it compares against can be
 * renamed in a migration while the query stays valid and stops matching: every row is dropped and
 * the cell reads as a campaign nobody committed to. A role with no rows at all passes.
 *
 * It cannot name the values it saw. They are the product's vocabulary and this package is
 * published.
 */
export class ExportStatusError extends Error {
  readonly rows: number;

  constructor(rows: number) {
    super(
      `the conversion role answered ${rows} rows and marked none of them committed. Every row is ` +
        "then dropped and the cell reports no conversions at all, which is indistinguishable from a " +
        "campaign nobody committed to. The usual cause is a value the `committed` predicate compares " +
        "against having been renamed, leaving the query valid and matching nothing — read the " +
        "predicate against the values the column actually holds. A role with no rows at all is a " +
        "fact and passes here; this is rows with nothing countable in them, which is a fault.",
    );
    this.name = "ExportStatusError";
    this.rows = rows;
  }
}
