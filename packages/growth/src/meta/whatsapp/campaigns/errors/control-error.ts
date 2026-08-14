/** A control pair that cannot be read: naming an undeclared cell, naming one cell on both sides,
 *  sharing so much as one identifier between its arms, reading an outcome neither the test nor the
 *  audience can take, reading a path the record does not carry, or a second control on one
 *  treated cell. */
export class ControlError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ControlError";
  }
}
