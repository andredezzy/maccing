// One-shot ancestral AGENTS.md sweep — the notion-api skill's MANDATORY first step in a single call.
// Climbs root→target via .parent, finds the `AGENTS.md` child_page on each ancestor, reads each as
// markdown, and returns them ordered root→closest with explicit precedence (closest wins on conflict).
// Replaces the ~8 sequential calls + hand-parsing the sweep used to take.

import { z } from "zod";
import { normalizeUuid, UUID_PATTERN } from "../notion/ids";
import { hasPublicToken, publicRequest } from "../notion/public-client";
import type { NotionChildrenResponse } from "../readers/blocks";
import { type NotionMarkdownResponse, normalizeCallouts } from "../readers/markdown";
import { type NotionPageBase, titleOf } from "../readers/page";
import type { NotionParentRef } from "../readers/parent";
import { err, errorMessage, ok, type ToolModule } from "../tool";

const MAX_DEPTH = 20; // guard against circular/malformed parent chains

interface PageLike extends NotionPageBase {
  parent?: NotionParentRef;
}

interface Ancestor {
  pageId: string;
  title: string;
}

interface AgentsMdEntry {
  title: string;
  agentsId: string;
  markdown: string;
}

/**
 * Normalize any target id — page, database row, block, database, or data_source — to the page where the
 * climb begins. A database/data_source isn't itself a page (its AGENTS.md lives on its PARENT page beside
 * the child_database block), so resolve those to that parent; a bare block resolves to its container page.
 */
async function resolveStartPage(id: string): Promise<string | undefined> {
  // Pages and database rows both resolve through /v1/pages — the common case, one probe.
  if ((await publicRequest("GET", `/v1/pages/${id}`)).ok) {
    return id;
  }

  // A database target — start from its parent page.
  if ((await publicRequest("GET", `/v1/databases/${id}`)).ok) {
    return pageIdForDatabase(id);
  }

  // A data_source target — climb to its database, then that database's parent page.
  const dataSource = await publicRequest("GET", `/v1/data_sources/${id}`);
  if (dataSource.ok) {
    const parent = (dataSource.body as PageLike).parent ?? {};
    return parent.database_id ? pageIdForDatabase(parent.database_id) : parent.page_id;
  }

  // Otherwise treat it as a bare block id.
  return pageIdForBlock(id);
}

/** Climb .parent from the start page to the workspace root; return ancestors root-first (root … target). */
async function climbToRoot(startId: string): Promise<Ancestor[]> {
  const chain: Ancestor[] = [];
  let pageId: string | undefined = await resolveStartPage(startId);
  let depth = 0;

  while (pageId && depth++ < MAX_DEPTH) {
    const response = await publicRequest("GET", `/v1/pages/${pageId}`);
    if (!response.ok) {
      break; // can't read this node — stop the climb (per-node failure, not a whole-sweep abort)
    }
    const page = response.body as PageLike;
    chain.push({ pageId, title: titleOf(page) });

    const parent = page.parent ?? {};
    if (parent.type === "page_id") {
      pageId = parent.page_id;
    } else if (parent.type === "block_id" && parent.block_id) {
      pageId = await pageIdForBlock(parent.block_id);
    } else if ((parent.type === "database_id" || parent.type === "data_source_id") && parent.database_id) {
      pageId = await pageIdForDatabase(parent.database_id); // a DB's AGENTS.md lives on its parent page
    } else {
      break; // workspace root (or an unknown parent type) — done
    }
  }

  return chain.reverse(); // root first
}

/** Resolve a block parent up to the page that contains it. */
async function pageIdForBlock(blockId: string): Promise<string | undefined> {
  const response = await publicRequest("GET", `/v1/blocks/${blockId}`);
  if (!response.ok) {
    return undefined;
  }
  const parent = (response.body as PageLike).parent ?? {};
  if (parent.type === "page_id") {
    return parent.page_id;
  }
  if (parent.type === "block_id" && parent.block_id) {
    return pageIdForBlock(parent.block_id);
  }
  return undefined;
}

/** A database's parent page (where its AGENTS.md and child_database block live). */
async function pageIdForDatabase(databaseId: string): Promise<string | undefined> {
  const response = await publicRequest("GET", `/v1/databases/${databaseId}`);
  if (!response.ok) {
    return undefined;
  }
  return (response.body as PageLike).parent?.page_id;
}

/** Find the `AGENTS.md` child_page id on a page (fully paginated), or null. */
async function findAgentsMdPageId(pageId: string): Promise<string | null> {
  let cursor: string | undefined;

  do {
    const query: Record<string, unknown> = { page_size: 100 };
    if (cursor) {
      query.start_cursor = cursor;
    }
    const response = await publicRequest("GET", `/v1/blocks/${pageId}/children`, undefined, query);
    if (!response.ok) {
      return null;
    }
    const body = response.body as NotionChildrenResponse;
    for (const block of body.results ?? []) {
      if (block.type === "child_page" && (block.child_page?.title ?? "").trim() === "AGENTS.md") {
        return block.id;
      }
    }
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return null;
}

async function readPageMarkdown(pageId: string): Promise<string> {
  const response = await publicRequest("GET", `/v1/pages/${pageId}/markdown`);
  if (!response.ok) {
    return "(could not read this AGENTS.md as markdown)";
  }
  return normalizeCallouts((response.body as NotionMarkdownResponse).markdown ?? "");
}

export const readAgentsMd: ToolModule = {
  name: "read_agents_md",
  config: {
    title: "Read the ancestral AGENTS.md chain",
    description:
      "MANDATORY FIRST STEP for any Notion task. Pass the id of your target — any page, database row, block, " +
      "database, or data_source; this walks root→target, finds every AGENTS.md playbook on the path, reads each as " +
      "markdown, and returns them ordered root→closest with explicit precedence (the closest one wins on " +
      "conflict). One call replaces the multi-step manual sweep. AGENTS.md pages are matched by exact title " +
      "'AGENTS.md' (the 🤖 convention).",
    annotations: { title: "Read ancestral AGENTS.md chain", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      id: z.string().describe("The target id to sweep from — any page, database row, block, database, or data_source."),
    },
  },

  handler: async (args) => {
    if (!hasPublicToken()) {
      return err("NOTION_TOKEN is not set.");
    }
    const targetId = normalizeUuid(String(args.id ?? ""));
    if (!UUID_PATTERN.test(targetId)) {
      return err("id must be a UUID.");
    }

    try {
      const ancestors = await climbToRoot(targetId);
      if (ancestors.length === 0) {
        return err(`Could not read ${targetId} — check the id and that NOTION_TOKEN has access.`);
      }

      const found: AgentsMdEntry[] = [];
      for (const ancestor of ancestors) {
        const agentsId = await findAgentsMdPageId(ancestor.pageId);
        if (agentsId) {
          found.push({ title: ancestor.title, agentsId, markdown: await readPageMarkdown(agentsId) });
        }
      }

      const target = ancestors[ancestors.length - 1];
      const ancestryBreadcrumb = ancestors.map((ancestor) => ancestor.title).join(" › ");

      if (found.length === 0) {
        return ok(
          `read_agents_md · target: ${target.title} (${targetId})\n` +
            `No AGENTS.md found on the ancestry (${ancestryBreadcrumb}). Proceed under the workspace's general conventions.`,
        );
      }

      const playbookCount = found.length;
      const indexLines = found
        .map((entry, index) => {
          const rank = index + 1;
          const role = rank === 1 ? "root" : rank === playbookCount ? "closest" : "intermediate";
          const weight =
            rank === playbookCount ? "STRONGEST — wins on conflict" : rank === 1 ? "weakest" : "overrides lower ranks";
          return `  rank ${rank}/${playbookCount} · ${entry.title} (${role}) · ${weight} · ${entry.agentsId}`;
        })
        .join("\n");

      const sections = found
        .map((entry, index) => {
          const rank = index + 1;
          const role = rank === 1 ? "root" : rank === playbookCount ? "closest" : "intermediate";
          const weight =
            rank === playbookCount
              ? "STRONGEST — overrides all earlier on conflict"
              : rank === 1
                ? "weakest"
                : "overrides earlier ranks";
          return `[PLAYBOOK ${rank}/${playbookCount} · governs: ${entry.title} (${role}) · precedence: ${weight}]\n${entry.markdown}`;
        })
        .join("\n\n");

      const preamble =
        `read_agents_md · target: ${target.title} (${targetId})\n` +
        `${playbookCount} playbook${playbookCount > 1 ? "s" : ""} govern this target, ordered root→closest. OBEY ALL; on any conflict the CLOSEST (higher rank) wins.\n` +
        `ancestry: ${ancestryBreadcrumb}\n${indexLines}`;

      return ok(`${preamble}\n\n${sections}`);
    } catch (error) {
      return err(errorMessage(error));
    }
  },
};
