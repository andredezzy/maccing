import { describe, expect, mock, test } from "bun:test";

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  test("returns results in input order, not completion order", async () => {
    const delays = [30, 5, 20, 1];

    const out = await mapWithConcurrency(delays, 4, async (ms, index) => {
      await Bun.sleep(ms);
      return index;
    });

    expect(out).toEqual([0, 1, 2, 3]);
  });

  test("never runs more than `limit` tasks at once", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Bun.sleep(5);
      active -= 1;
    });

    expect(peak).toBe(3);
  });

  test("runs concurrently rather than serially", async () => {
    const started = Date.now();

    await mapWithConcurrency([1, 2, 3, 4], 4, async () => {
      await Bun.sleep(40);
    });

    // Four 40ms tasks: ~40ms concurrent, ~160ms serial. The midpoint is a
    // generous margin that still fails if the work is sequential.
    expect(Date.now() - started).toBeLessThan(100);
  });

  test("a rejecting task fails the whole call", async () => {
    const boom = mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) {
        throw new Error("task failed");
      }
      return n;
    });

    expect(boom).rejects.toThrow("task failed");
  });

  test("an empty input does no work and returns nothing", async () => {
    const task = mock(async () => 1);

    const out = await mapWithConcurrency([], 4, task);

    expect(out).toEqual([]);
    expect(task).not.toHaveBeenCalled();
  });

  test("a limit below one still makes progress instead of hanging", async () => {
    const out = await mapWithConcurrency([1, 2, 3], 0, async (n) => n * 2);

    expect(out).toEqual([2, 4, 6]);
  });

  test("a limit larger than the input does not over-allocate workers", async () => {
    let peak = 0;
    let active = 0;

    await mapWithConcurrency([1, 2], 50, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Bun.sleep(5);
      active -= 1;
    });

    expect(peak).toBe(2);
  });
});
