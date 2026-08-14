/** A cell's lists yielded nothing usable, either as read or after its exclusions were subtracted. */
export class EmptyCellError extends Error {
  readonly cell: string;
  /** Which of the two emptinesses this is, so a caller need not match on the sentence to tell an
   *  over-narrow filter from an over-broad `exclude`. */
  readonly after_exclusions: boolean;

  constructor(cell: string, lists: readonly string[], column: string | undefined, after_exclusions: boolean) {
    const where = `${lists.join(", ")}${column === undefined ? "" : ` (column ${JSON.stringify(column)})`}`;
    super(
      after_exclusions
        ? `cell ${JSON.stringify(cell)} has nothing left once its exclusions are subtracted: every ` +
            `identifier read from ${where} is also listed in \`exclude\`. Narrow the exclusions, or point ` +
            "the cell at the list it was meant to measure. A cell that is entirely probes has no members " +
            "to attribute anything to, and emitting it would publish a row of zeros for an audience that " +
            "was never there."
        : `cell ${JSON.stringify(cell)} yielded no usable identifier from ${where}. Check that this is ` +
            "the file that was sent, and that its numbers are written in the format the map declares. An " +
            "empty cell reads as 'nothing converted' when the truth is that the file is the wrong one or " +
            "every number in it was unreadable, so it stops the run rather than emitting a row of zeros.",
    );
    this.name = "EmptyCellError";
    this.cell = cell;
    this.after_exclusions = after_exclusions;
  }
}
