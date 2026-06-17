// mirrors developers.notion.com/reference/parent-object
import { z } from "zod";

// A parent reference is a lightweight pointer: a `type` plus the matching id field. Every field is
// optional so this one schema serves both well-formed API responses AND the defensive `parentLabel`
// display helper (used during the AGENTS.md parent-chain climb), which must render partial/loose refs
// without throwing. A `data_source_id` parent carries BOTH `data_source_id` and `database_id`.
// `agent_id` (owner of instruction pages/blocks) is a live-doc type beyond the original five.

export const parentRef = z.object({
  type: z.enum(["page_id", "block_id", "database_id", "data_source_id", "workspace", "agent_id"]).optional(),
  page_id: z.string().optional(),
  block_id: z.string().optional(),
  database_id: z.string().optional(),
  data_source_id: z.string().optional(),
  workspace: z.boolean().optional(),
  agent_id: z.string().optional(),
});

export type ParentRef = z.infer<typeof parentRef>;
