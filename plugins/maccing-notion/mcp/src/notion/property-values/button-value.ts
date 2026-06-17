// mirrors developers.notion.com/reference/page-property-values — button property value
// The button payload is effectively empty in the API response (no data, just triggers an action).
import { z } from "zod";

export const buttonValue = z.object({
  id: z.string().optional(),
  type: z.literal("button"),
  button: z.record(z.string(), z.unknown()),
});

export type ButtonValue = z.infer<typeof buttonValue>;
