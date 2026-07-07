// mirrors developers.notion.com/reference/page-property-values — verification property value
// Nullable at the top level: unverified pages may return null from the API.
import { z } from "zod";
import { user } from "../user";
import { datePayload } from "./date-value";

const verificationPayload = z.object({
  state: z.string().optional(),
  verified_by: user.nullable().optional(),
  date: datePayload.nullable().optional(),
});

export const verificationValue = z.object({
  id: z.string().optional(),
  type: z.literal("verification"),
  verification: verificationPayload.nullable(),
});
