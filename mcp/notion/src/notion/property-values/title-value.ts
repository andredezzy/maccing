// mirrors developers.notion.com/reference/page-property-values — title property value
import { z } from "zod";
import { richText } from "../rich-text";

export const titleValue = z.object({
  id: z.string().optional(),
  type: z.literal("title"),
  title: z.array(richText),
});
