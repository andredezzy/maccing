// mirrors developers.notion.com/reference/page-property-values — phone_number property value
import { z } from "zod";

export const phoneNumberValue = z.object({
  id: z.string().optional(),
  type: z.literal("phone_number"),
  phone_number: z.string().nullable(),
});

export type PhoneNumberValue = z.infer<typeof phoneNumberValue>;
