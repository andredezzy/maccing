import { z } from "zod";
import { blockMeta } from "./_envelope";

export const equation = z.object({
  ...blockMeta,
  type: z.literal("equation"),
  equation: z.object({ expression: z.string() }),
});
