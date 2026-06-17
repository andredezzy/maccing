// mirrors developers.notion.com/reference/page-property-values — rich_text property value
import { z } from "zod";
import { richText } from "../rich-text";

export const richTextValue = z.object({
  id: z.string().optional(),
  type: z.literal("rich_text"),
  rich_text: z.array(richText),
});

export type RichTextValue = z.infer<typeof richTextValue>;
