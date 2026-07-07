// mirrors developers.notion.com/reference/user
import { z } from "zod";

const botOwner = z.object({
  type: z.enum(["workspace", "user"]).optional(),
  workspace: z.boolean().optional(),
});

const botWorkspaceLimits = z.object({
  max_file_upload_size_in_bytes: z.number().int().optional(),
});

const bot = z.object({
  owner: botOwner.optional(),
  workspace_name: z.string().nullable().optional(),
  workspace_id: z.string().optional(),
  workspace_limits: botWorkspaceLimits.optional(),
});

export const user = z.object({
  object: z.literal("user").optional(),
  id: z.string().optional(),
  type: z.enum(["person", "bot"]).optional(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  person: z.object({ email: z.string().optional() }).optional(),
  bot: bot.optional(),
});

export type UserObject = z.infer<typeof user>;
