/**
 * A cell whose list is drawn from a different set of markets than the base it is measured against,
 * beyond `max_market_divergence`.
 *
 * Measured as a distribution because no per-number check can see it: every number parses, the keys
 * are well-formed, and the join simply misses, which on a cold list reads as a campaign that did
 * not land.
 */
export class MarketDivergenceError extends Error {
  readonly cell: string;
  readonly divergence: number;

  constructor(cell: string, divergence: number, ceiling: number) {
    super(
      `cell ${JSON.stringify(cell)} draws from markets that share ` +
        `${((1 - divergence) * 100).toFixed(1)}% of their distribution with the base being measured, ` +
        `and the run refuses below ${((1 - ceiling) * 100).toFixed(1)}%. Every number in the list may ` +
        "be valid; the point is that they are numbers from somewhere else, so the join misses for a " +
        "reason no per-number check can see. On a cold list that reads as a campaign nobody answered. " +
        "Either the wrong file is named here, or this campaign genuinely ran in another market and " +
        "`max_market_divergence` should say so.",
    );
    this.name = "MarketDivergenceError";
    this.cell = cell;
    this.divergence = divergence;
  }
}
