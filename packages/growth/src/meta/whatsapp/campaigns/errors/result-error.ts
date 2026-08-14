/** A result that cannot be computed: a cost that is not a finite number at or above zero, a
 *  revenue path no cell's record carries, or a control naming a cell that was never declared. */
export class ResultError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ResultError";
  }
}
