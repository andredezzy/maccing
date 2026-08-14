/** A cell that cannot be measured as written: a cut that is unreadable, blank, sub-millisecond,
 *  later than the reading, or naming a day its month does not have; or a duplicated cell name. */
export class CellDeclarationError extends Error {
  readonly cell: string;

  constructor(cell: string, reason: string) {
    super(`cell ${JSON.stringify(cell)}: ${reason}`);
    this.name = "CellDeclarationError";
    this.cell = cell;
  }
}
