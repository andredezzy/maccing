// mirrors developers.notion.com/reference/page-property-values — files property value
import { z } from "zod";
import { fileObject } from "../file";

export const filesValue = z.object({
  id: z.string().optional(),
  type: z.literal("files"),
  files: z.array(fileObject),
});
