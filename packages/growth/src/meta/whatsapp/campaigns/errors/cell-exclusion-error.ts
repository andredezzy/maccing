/** An exclusion entry that cannot be read as a number in the declared format.
 *
 *  The one refusal in the pass that guards against overstatement rather than a silent zero: an
 *  entry that yields no key subtracts nobody, so the probe it names stays in the cell and
 *  everything that account did is counted as the campaign's. A mistyped digit, an extension
 *  pushing the string past a national length, and an empty string all land here. A value that
 *  yields a well-formed key for somebody else does not, being indistinguishable from a real one. */
export class CellExclusionError extends Error {
  readonly cell: string;
  readonly entries: readonly string[];

  constructor(cell: string, entries: readonly string[]) {
    const listed = entries.map((entry) => JSON.stringify(entry)).join(", ");
    const count = entries.length === 1 ? "an exclusion" : `${entries.length} exclusions`;
    super(
      `cell ${JSON.stringify(cell)} lists ${count} that cannot be read as a number in the format ` +
        `the map declares: ${listed}. An entry that yields no key subtracts nobody, so the account ` +
        "it names stays in the cell and everything that account did is counted as this campaign's " +
        "— the reading comes out too high rather than empty, which is the failure that survives " +
        "review. Correct the spelling, or drop the entry if the number it meant to remove is not " +
        "one this cell could reach.",
    );
    this.name = "CellExclusionError";
    this.cell = cell;
    this.entries = entries;
  }
}
