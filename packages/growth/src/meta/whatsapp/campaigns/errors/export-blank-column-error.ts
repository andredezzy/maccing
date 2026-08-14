const BLANK_COLUMN_CONSEQUENCE = {
  timestamp: "every event then falls out of the accumulator silently: a full file of real events reports as none",
  "phone number":
    "every row then fails to reach the index silently: a full base of real accounts matches nobody, " +
    "and every cell reports an audience that was never there",
};

/** What a bound column holds. Spelled out at every throw site rather than defaulted, so no call
 *  site can inherit a sentence describing the wrong kind of column. Must read as a singular noun
 *  phrase: the message interpolates it as "binds X for its <kind>" and "now holds the <kind>". */
type BlankColumnKind = keyof typeof BLANK_COLUMN_CONSEQUENCE;

/** A bound column that is in the header and empty, or unreadable, on every row. An export with no
 *  rows at all is a fact and passes; this is rows with nothing readable in them. */
export class ExportBlankColumnError extends Error {
  readonly path: string;
  readonly role: string;
  readonly columns: readonly string[];

  constructor(path: string, role: string, columns: readonly string[], rows: number, what: BlankColumnKind) {
    const named = columns.map((name) => JSON.stringify(name)).join(" or ");
    super(
      `the ${role} role binds ${named} for its ${what}, and not one of the ${rows} rows in ${path} ` +
        `carries a readable one. The column is in the header, so the binding passes and ` +
        `${BLANK_COLUMN_CONSEQUENCE[what]}. A ` +
        "column renamed at the source often leaves the old one behind, present and blank on every row, " +
        `which is exactly this. Re-export with the column populated, or bind the one that now holds the ` +
        `${what}. A file with no rows at all is a fact and passes here — this is a file with rows and ` +
        "nothing readable in them, which is a fault.",
    );
    this.name = "ExportBlankColumnError";
    this.path = path;
    this.role = role;
    this.columns = columns;
  }
}
