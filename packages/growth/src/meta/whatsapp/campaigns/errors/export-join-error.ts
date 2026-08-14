/** A role's export that references nobody in the person export. Every row can be well-formed while
 *  the join is against the wrong kind of identifier, so the whole file falls out of every cell. */
export class ExportJoinError extends Error {
  readonly path: string;
  readonly role: string;
  readonly column: string;

  constructor(path: string, role: string, column: string, sample: string, person_sample: string, identifiers: number) {
    super(
      `the ${role} role binds ${JSON.stringify(column)} to reference a person, and not one of the ` +
        `${identifiers} distinct identifiers in ${path} appears in the person export. One of them reads ` +
        `${JSON.stringify(sample)}; the person export's first id is ${JSON.stringify(person_sample)}. ` +
        "Every row in it can be well-formed and still reference nobody, so every event here falls out " +
        "of every cell and the run reports a matched audience that did nothing. A column holding the " +
        "wrong kind of id — a wallet, an order, a row's own primary key where the person's was meant " +
        "— is what this looks like, and it is silent in every other check. Bind the column that " +
        "carries the person, or re-export through the join that resolves it.",
    );
    this.name = "ExportJoinError";
    this.path = path;
    this.role = role;
    this.column = column;
  }
}
