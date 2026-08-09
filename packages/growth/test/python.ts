import { test } from "bun:test";

/**
 * The Python cross-checks in `erf.test.ts`, `round.test.ts` and `stats.test.ts` are the package's
 * only independent oracles: `math.erf`, `statistics.median`, and Python's `round()` — the last
 * being the whole reason `round.ts` exists instead of a call to `toFixed`. Every other case in
 * those files compares the code against numbers a person typed, and that person is the one who
 * could have typed them wrong.
 *
 * So a missing interpreter is loud where it matters and quiet where it does not. Silently
 * skipping the three would let a CI image with no Python put a green tick over a byte-identity
 * guarantee nothing checked, and the first anyone hears of it is a rounded figure that disagrees
 * with the finance sheet. Skipping stays available for a local loop, but only by saying so.
 */

/** Set to any non-empty value to permit the skip. Named to read straight out of the failure. */
const PERMIT = "GROWTH_ALLOW_MISSING_PYTHON3";

/**
 * Runs a Python snippet and returns its stdout lines, or null when there is no usable `python3`.
 * A real spawn is the probe rather than a PATH lookup, because a `python3` that exists and cannot
 * run is the same problem as one that is absent.
 */
export function python_lines(script: string): string[] | null {
  let stdout: string;
  try {
    const proc = Bun.spawnSync(["python3", "-c", script]);
    if (!proc.success) {
      return null;
    }
    stdout = proc.stdout.toString();
  } catch {
    return null;
  }
  const trimmed = stdout.trim();
  return trimmed === "" ? [] : trimmed.split("\n");
}

/** Attempted once, at load, so the choice below is made from a fact and not from a PATH guess. */
const PYTHON_AVAILABLE = python_lines("print(1 + 1)")?.[0] === "2";

const SKIP_PERMITTED = (Bun.env[PERMIT] ?? "") !== "";

const ABSENT =
  "no usable python3, so this cross-check cannot run and the result it guards is unverified. " +
  `Install python3, or set ${PERMIT}=1 to run without the Python oracles.`;

/** The call shape all three cross-checks use; nothing needs `.each`, `.only` or a timeout. */
type PythonTest = (name: string, body: () => void) => void;

/**
 * Registers a Python cross-check. Interpreter present: it runs. Absent with the skip permitted:
 * it skips. Absent with nothing permitting it, it is registered as a test whose only act is to
 * fail — a run that stopped checking the one thing nothing else checks has to say so somewhere a
 * CI log will show it, and a skip does not.
 */
export const python_test: PythonTest = PYTHON_AVAILABLE
  ? test
  : SKIP_PERMITTED
    ? test.skip
    : (name) => {
        test(name, () => {
          throw new Error(ABSENT);
        });
      };
