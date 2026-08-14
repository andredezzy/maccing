/** A column the map binds for a role is not in that role's export. */
export class ExportColumnError extends Error {
  readonly path: string;
  readonly role: string;
  readonly column: string;

  constructor(path: string, role: string, column: string, header: readonly string[]) {
    super(
      `the ${role} role binds column ${JSON.stringify(column)}, and ${path} does not carry it. Its ` +
        `header is ${header.map((name) => JSON.stringify(name)).join(", ") || "(empty)"}. Either the map ` +
        "names a column that has since been renamed, or this export came from the wrong query — the " +
        "header above says which, and without it the reader goes looking in the wrong file. Correct the " +
        "binding or re-export, then measure again.",
    );
    this.name = "ExportColumnError";
    this.path = path;
    this.role = role;
    this.column = column;
  }
}
