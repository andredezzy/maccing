/** An `own_base` cell not one of whose listed identifiers answers for an account.
 *
 *  `own_base` is the claim that these people already hold accounts, so nothing matched contradicts
 *  the declaration and every count would publish as a base that was reached and did nothing. The
 *  same zeros on a `cold` cell are measured, because there they are the finding.
 *
 *  Raised only where the person export built an index at all. With no index no cell of any
 *  audience can match, and naming the cell would send the reader to the wrong file. */
export class UnmatchedBaseError extends Error {
  readonly cell: string;
  readonly listed: number;

  constructor(cell: string, listed: number) {
    super(
      `cell ${JSON.stringify(cell)} is declared own_base, and not one of its ${listed} listed ` +
        "identifiers answers for an account in the lead role. own_base is the claim that these " +
        "people already hold accounts, so nothing matched is not a reading: every count on the " +
        "record comes back zero and publishes as a base that was reached and did nothing. The list " +
        "names people this export does not cover, or the cell's `column` holds numbers that are not " +
        "phones, or the export was cut to a window or a segment narrower than the list. Take one " +
        "listed number and look for it in the export by hand before changing either of them. A cold " +
        "cell matching nobody is measured, because there it is the finding; this one contradicts " +
        "its own declaration.",
    );
    this.name = "UnmatchedBaseError";
    this.cell = cell;
    this.listed = listed;
  }
}
