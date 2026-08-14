/** Outcomes counted against a cut the declaration itself calls a placeholder. */
export class ProvisionalCutError extends Error {
  readonly cells: readonly { cell: string; counted: readonly { outcome: string; count: number }[] }[];

  constructor(cells: readonly { cell: string; counted: readonly { outcome: string; count: number }[] }[]) {
    const named = cells
      .map(
        (entry) =>
          `${JSON.stringify(entry.cell)} (${entry.counted.map((one) => `${one.outcome} ${one.count}`).join(", ")})`,
      )
      .join("; ");
    super(
      `outcomes counted against a cut that is declared provisional: ${named}. A provisional cut stands ` +
        "in for a send whose real moment is not known yet, so every count above is dated against a guess " +
        "and none of them can be attributed to anything. Put the confirmed send time in `cut` and drop " +
        "`cut_provisional`, or leave the cell out of this reading.",
    );
    this.name = "ProvisionalCutError";
    this.cells = cells;
  }
}
