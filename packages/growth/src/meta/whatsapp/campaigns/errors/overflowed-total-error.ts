/** A published money total that summed past the range a number here can hold.
 *
 *  Test for finiteness rather than for infinity: two overflows of opposite sign, a group of
 *  refunds against a group of payments, sum to `NaN`, and `NaN` serialises as the same JSON `null`
 *  an infinity does. That `null` is also what the record publishes for a role nobody bound, so an
 *  overflow left alone reads as a documented absence. `field` is the record's own dotted path. */
export class OverflowedTotalError extends Error {
  readonly cell: string;
  readonly field: string;

  constructor(cell: string, field: string) {
    super(
      `cell ${JSON.stringify(cell)} summed ${field} past the largest number this engine can hold, so ` +
        "the field would publish as JSON null — the same null the record uses for a total it never " +
        "measured, which reads as a role the map does not bind rather than as arithmetic that came " +
        "apart. Every row behind it is a finite number and each one passed the per-row check, so the " +
        "fault is in the magnitudes rather than in any single value: an amount column exported in a " +
        "unit the map does not assume, or a planted row left in from a test. Sort that export by " +
        "amount and read the top of it.",
    );
    this.name = "OverflowedTotalError";
    this.cell = cell;
    this.field = field;
  }
}
