import { z } from "zod";
import { parentRef } from "../parent";
import { user } from "../user";

// Every block carries this server-set metadata — all optional so a hand-authored proposal validates.
export const blockMeta = {
  object: z.literal("block").optional(),
  id: z.string().optional(),
  parent: parentRef.optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: user.optional(),
  last_edited_by: user.optional(),
  has_children: z.boolean().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
};
