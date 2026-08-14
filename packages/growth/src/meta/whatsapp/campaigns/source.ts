/**
 * Where a run's rows come from, and the two adapters this package ships.
 *
 * Values cross this boundary as strings. Every guard downstream parses text, so a driver-typed
 * value would skip checks a CSV still runs; an adapter renders its values the way a CSV would.
 */

import { SQL } from "bun";
import type { Rows } from "../../../internal/table.ts";
import { SourceError } from "./errors/source-error.ts";
import { TimestampDriverError } from "./errors/timestamp-driver-error.ts";
import { read_rows } from "../../../internal/table.ts";

/** Every error this module raises, one class per file under `errors/`. They are re-exported
 *  here because this module is the published entry point and a consumer catches them by name. */
export { SourceError } from "./errors/source-error.ts";
export { TimestampDriverError } from "./errors/timestamp-driver-error.ts";

/** The four things a campaign is measured from. */
export type RoleName = "lead" | "revenue" | "churn" | "conversion";

/**
 * A source of rows, one role at a time. The row contract - which columns each role must carry,
 * and the literal `true`/`false` that `committed` and `recycled` must be spelled with - is in the
 * package README.
 */
export type Source = {
  /**
   * Rows for one role. Neither header nor records says the role is unbound, which the record
   * keeps distinct from a role carrying nothing; only `revenue` and `churn` may be. `header`
   * travels separately because two columns of one name collapse into one key in the records.
   */
  rows(role: RoleName): Promise<Rows>;
};
/** One SQL statement per role, aliasing to the contract's column names. `revenue` and `churn` are optional. */
export type Queries = {
  lead: string;
  conversion: string;
  revenue?: string;
  churn?: string;
};

/**
 * Rows straight from Postgres, so nothing is written to disk. Each `rows` call opens its own
 * connection and closes it before returning: one per bound role, nothing pooled, nothing held
 * between calls. A role `queries` does not name answers unbound, `null` renders as the empty cell
 * a CSV would carry, and a timestamp not cast to text throws `TimestampDriverError`.
 */
export function postgres(url: string, options: { queries: Queries }): Source {
  return {
    async rows(role: RoleName): Promise<Rows> {
      const query = options.queries[role];
      if (query === undefined) {
        return { header: [], records: [] };
      }
      const sql = new SQL(url);
      // Only the query itself is wrapped. Rows that ran and came back unusable are a different
      // failure, and folding them in here would bury that message under "could not be run".
      let result: Record<string, unknown>[];
      try {
        result = (await sql.unsafe(query)) as Record<string, unknown>[];
      } catch (failure) {
        throw new SourceError(
          role,
          `the ${role} query could not be run. The engine reads four roles and this one answered ` +
            "with an error rather than rows, so the run has no basis to measure from.",
          { cause: failure },
        );
      } finally {
        await sql.close();
      }
      return driver_rows(role, result);
    },
  };
}

/** What a driver handed back, as the strings this boundary carries. A `Date` throws `TimestampDriverError`. */
export function driver_rows(role: RoleName, result: Record<string, unknown>[]): Rows {
  const records = result.map((row) => {
    const out: Record<string, string> = {};
    for (const [column, value] of Object.entries(row)) {
      if (value instanceof Date) {
        throw new TimestampDriverError(role, column);
      }
      out[column] = value === null || value === undefined ? "" : render(value);
    }
    return out;
  });
  // No duplicate-column check is possible here: a driver hands back objects, so two columns
  // aliased alike have already collapsed. The header describes what arrived.
  return { header: Object.keys(result[0] ?? {}), records };
}

/** What a CSV would have held for this value. Dates never reach here - see `TimestampDriverError`. */
function render(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}
/**
 * Rows from a directory of exported files, one per role: `<directory>/<role>.csv` - `lead.csv`,
 * `revenue.csv`, `churn.csv`, `conversion.csv` - unless `names` renames one. It reads what
 * `psql \copy` writes. An absent `revenue.csv` or `churn.csv` leaves that role unbound; an absent
 * required file throws `SourceError`.
 */
export function files(directory: string, options?: { names?: Partial<Record<RoleName, string>> }): Source {
  return {
    async rows(role: RoleName): Promise<Rows> {
      const name = options?.names?.[role] ?? `${role}.csv`;
      const path = `${directory}/${name}`;
      if (!(await Bun.file(path).exists())) {
        // An absent optional role is a product that does not collect it, not a zero.
        if (role === "revenue" || role === "churn") {
          return { header: [], records: [] };
        }
        throw new SourceError(
          role,
          `no file for the ${role} role at ${path}. A directory source expects one file per role, ` +
            `named ${role}.csv unless the source was given another name for it.`,
        );
      }
      return read_rows(path);
    },
  };
}
