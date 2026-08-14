/**
 * A column the contract reads as a boolean, holding something other than `true` or `false`.
 *
 * Kept apart from `ExportValueError`, which is about amounts. The usual cause is a query passing
 * its own vocabulary through where the contract asked for the answer to a question, and reading
 * an unrecognised value as `false` would drop every row it applies to in silence.
 */
export class ExportFlagError extends Error {
  readonly role: string;
  readonly column: string;
  readonly raw: string;

  constructor(role: string, column: string, raw: string) {
    super(
      `the ${role} role's ${JSON.stringify(column)} column holds ${JSON.stringify(raw)}, and the ` +
        "contract reads it as a boolean: the literal `true` or the literal `false`, nothing else. " +
        (raw === ""
          ? "It is empty on this row, and an unanswered question is not an answer of no."
          : "This looks like a value from the source's own vocabulary being passed through where " +
            "the query should have answered the question instead - `(status in (...)) as committed` " +
            "rather than `status as committed`.") +
        " Reading it as false would drop the row from every count without a word.",
    );
    this.name = "ExportFlagError";
    this.role = role;
    this.column = column;
    this.raw = raw;
  }
}
