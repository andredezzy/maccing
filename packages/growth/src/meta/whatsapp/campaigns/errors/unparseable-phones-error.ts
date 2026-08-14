/**
 * More of a corpus's distinct identifiers are unreadable than the run permits.
 *
 * Raised against the person export and against a cell's own lists; `source` says which. The fault
 * has opposite signs on the two sides: unreadable people shrink the index, unreadable list entries
 * shrink the denominator every rate is divided by.
 */
export class UnparseablePhonesError extends Error {
  readonly source: string;

  constructor(unreadable: number, total: number, rate: number, ceiling: number, source = "the person export") {
    super(
      `${unreadable} of ${total} distinct identifiers in ${source} could not be read ` +
        `(${(rate * 100).toFixed(1)}%), ` +
        `above the ${(ceiling * 100).toFixed(1)}% the map allows. A dialling plan that does not match this ` +
        "market and a list of people who genuinely never registered produce the same zero, and only one of " +
        "them is a result — so the run stops instead of reporting it. Either the map's phone format is wrong " +
        "for this data, or the file is.",
    );
    this.name = "UnparseablePhonesError";
    this.source = source;
  }
}
