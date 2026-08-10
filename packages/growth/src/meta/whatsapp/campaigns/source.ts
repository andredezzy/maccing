/**
 * Where a run's rows come from, and the two adapters this package ships.
 *
 * The engine reads four roles and does not care where they live. Everything it needs arrives
 * through one method, so a project can measure against a database, a directory of exports, an
 * API, or anything else it can turn into rows — without this package learning what any of those
 * are. The database in particular is always the caller's: its URL, its queries and its schema
 * never enter this package, and nothing here names a table, a column or a status.
 *
 * **The boundary speaks strings.** Every guard downstream parses text — a blank cell, a value that
 * is not a number, a timestamp that is not a timestamp, a person appearing twice. If rows crossed
 * as native types, a database adapter would skip checks a CSV adapter still ran and the two would
 * disagree about identical data. Strings mean every source inherits the same validation, and an
 * adapter's only obligation is to render its values the way a CSV would.
 */

import { SQL } from "bun";
import type { Rows } from "../../../internal/table.ts";
import { read_rows } from "../../../internal/table.ts";

/** The four things a campaign is measured from. */
export type RoleName = "lead" | "revenue" | "churn" | "conversion";

/**
 * The columns a role's rows must carry, by the contract's names rather than the database's — a
 * query aliases to them, a CSV header spells them.
 *
 * | role | required | optional |
 * |---|---|---|
 * | `lead` | `id`, `phone`, `created_at` | — |
 * | `revenue` | `lead`, `at`, `amount` | — |
 * | `churn` | `lead`, `at`, `amount` | — |
 * | `conversion` | `lead`, `at`, `amount`, `committed` | `at_fallback`, `recycled` |
 *
 * `committed` and `recycled` are predicates the source answers, not statuses this package
 * interprets: which values count as a commitment, and which mean value was recycled rather than
 * new, are properties of a product and stay in the query that knows them. Omitting `recycled`
 * declares that the product has no recycled-balance concept, which is a different fact from
 * measuring zero.
 */
export type Source = {
  /**
   * Rows for one role. Absent optional roles answer with an empty table.
   *
   * `header` travels beside the records because a duplicated column is a fault the records alone
   * cannot show: two columns of the same name collapse into one key, and the value that survives
   * depends on order. The engine refuses that rather than reading whichever won.
   */
  rows(role: RoleName): Promise<Rows>;
};

/** A role's rows could not be fetched, with the role named and the cause kept. */
export class SourceError extends Error {
  readonly role: RoleName;

  constructor(role: RoleName, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SourceError";
    this.role = role;
  }
}

/** One query per role. `revenue` and `churn` are optional: a product may collect neither. */
export type Queries = {
  lead: string;
  conversion: string;
  revenue?: string;
  churn?: string;
};

/**
 * Rows straight from Postgres, so nothing is written to disk.
 *
 * This retires the export step and the rule that went with it. The role files were the entire user
 * base with personal data in them, and "deleted after the run" was a sentence in a document rather
 * than a guarantee; a run that never writes them cannot forget to. Credentials are the caller's
 * and are never stored here — the URL arrives per call and goes no further than the connection.
 *
 * `Bun.sql` is built into the runtime this package already targets, so reading a database costs no
 * dependency.
 *
 * Values are rendered as strings because the boundary speaks strings; `null` becomes the empty
 * cell a CSV would carry, so an absent value is absent the same way from every source.
 */
export function postgres(url: string, options: { queries: Queries }): Source {
  return {
    async rows(role: RoleName): Promise<Rows> {
      const query = options.queries[role];
      if (query === undefined) {
        return { header: [], records: [] };
      }
      const sql = new SQL(url);
      try {
        const result = (await sql.unsafe(query)) as Record<string, unknown>[];
        const records = result.map((row) => {
          const out: Record<string, string> = {};
          for (const [column, value] of Object.entries(row)) {
            out[column] = value === null || value === undefined ? "" : render(value);
          }
          return out;
        });
        // A driver hands back objects, so two columns aliased alike have already collapsed into
        // one and the shadow check downstream has nothing left to find. Naming a column twice in
        // one `select` is the query author's fault and their editor's to catch; the header here
        // describes what actually arrived.
        return { header: Object.keys(result[0] ?? {}), records };
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
    },
  };
}

/** What a CSV would have held for this value. */
function render(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Rows from a directory of exported files, one per role.
 *
 * Kept because a database is not the only honest source: a project may be handed extracts it does
 * not own, and a fixture is a directory. It reads what `psql \copy` writes, so the manual path
 * still works for anyone who wants it.
 */
export function files(directory: string, options?: { names?: Partial<Record<RoleName, string>> }): Source {
  return {
    async rows(role: RoleName): Promise<Rows> {
      const name = options?.names?.[role] ?? `${role}.csv`;
      const path = `${directory}/${name}`;
      if (!(await Bun.file(path).exists())) {
        // An absent optional role is a product that does not collect it; an absent required one is
        // a broken run, and the engine says so when the rows do not arrive.
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
