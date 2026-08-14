import type { RoleName } from "../source.ts";

/**
 * A query that handed the driver a timestamp instead of text. `Bun.sql` reads a `timestamp
 * without time zone` as a wall clock in the *client's* timezone, so the same row is a different
 * instant on every machine that measures it, and the session timezone cannot help because the
 * conversion never reaches the server. A real `timestamptz` comes back correct through the same
 * path and is indistinguishable here, so this refuses rather than undoing an offset that may be
 * right; the message names the cast.
 */
export class TimestampDriverError extends Error {
  readonly role: RoleName;
  readonly column: string;

  constructor(role: RoleName, column: string) {
    super(
      `the ${role} query returned column ${JSON.stringify(column)} as a timestamp rather than as ` +
        "text, and this boundary carries strings. The driver builds that value by reading the " +
        "stored wall clock in whatever timezone the measuring machine happens to be in, so the " +
        "same row would be read as a different moment somewhere else and no error would ever say " +
        `so. Cast it in the query - \`${column}::text\` for a naive \`timestamp\`, or ` +
        `\`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MSZ')\` for a ` +
        "`timestamptz` - and the value arrives meaning one thing everywhere.",
    );
    this.name = "TimestampDriverError";
    this.role = role;
    this.column = column;
  }
}
