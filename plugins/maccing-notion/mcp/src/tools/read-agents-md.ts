// One-shot ancestral AGENTS.md sweep — the notion-api skill's MANDATORY first step in a single call.
// Climbs root→target via .parent, finds the `AGENTS.md` child_page on each ancestor, reads each as
// markdown, and returns them ordered root→closest with explicit precedence (closest wins on conflict).
// Replaces the ~8 sequential calls + hand-parsing the sweep used to take.

import { z } from "zod";
import { normalizeUuid } from "../lib/normalize-uuid";
import { normalizeCallouts } from "../lib/notion-markdown";
import { type PageWithProps, titleOf } from "../lib/notion-page";
import { hasPublicToken, publicRequest } from "../lib/notion-public";
import { err, ok, type ToolModule } from "../tool";

const UUID = /^[0-9a-f-]{32,36}$/i;
const MAX_DEPTH = 20; // guard against circular/malformed parent chains

interface ParentRef {
  type?: string;
  page_id?: string;
  block_id?: string;
  database_id?: string;
  data_source_id?: string;
  workspace?: boolean;
}

interface PageLike extends PageWithProps {
  parent?: ParentRef;
}

interface Ancestor {
  pageId: string;
  title: string;
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
  let guard = 0;

  while (pageId && guard++ < MAX_DEPTH) {
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

interface ChildBlock {
  id: string;
  type: string;
  child_page?: { title?: string };
}

interface ChildrenResponse {
  results?: ChildBlock[];
  has_more?: boolean;
  next_cursor?: string | null;
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
    const body = response.body as ChildrenResponse;
    for (const block of body.results ?? []) {
      if (block.type === "child_page" && (block.child_page?.title ?? "").trim() === "AGENTS.md") {
        return block.id;
      }
    }
    cursor = body.has_more ? (body.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return null;
}

interface MarkdownResponse {
  markdown?: string;
}

async function readMarkdown(pageId: string): Promise<string> {
  const response = await publicRequest("GET", `/v1/pages/${pageId}/markdown`);
  if (!response.ok) {
    return "(could not read this AGENTS.md as markdown)";
  }
  return normalizeCallouts((response.body as MarkdownResponse).markdown ?? "");
}

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-5)}`;

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
    const pageId = normalizeUuid(String(args.id ?? ""));
    if (!UUID.test(pageId)) {
      return err("page_id must be a UUID.");
    }

    try {
      const ancestors = await climbToRoot(pageId);
      if (ancestors.length === 0) {
        return err(`Could not read ${pageId} — check the id and that NOTION_TOKEN has access.`);
      }

      const found: { title: string; agentsId: string; markdown: string }[] = [];
      for (const ancestor of ancestors) {
        const agentsId = await findAgentsMdPageId(ancestor.pageId);
        if (agentsId) {
          found.push({ title: ancestor.title, agentsId, markdown: await readMarkdown(agentsId) });
        }
      }

      const target = ancestors[ancestors.length - 1];
      const path = ancestors.map((a) => a.title).join(" › ");

      if (found.length === 0) {
        return ok(
          `read_agents_md · target: ${target.title} (${short(pageId)})\n` +
            `No AGENTS.md found on the ancestry (${path}). Proceed under the workspace's general conventions.`,
        );
      }

      const total = found.length;
      const indexLines = found
        .map((f, i) => {
          const rank = i + 1;
          const role = rank === 1 ? "root" : rank === total ? "closest" : "intermediate";
          const weight =
            rank === total ? "STRONGEST — wins on conflict" : rank === 1 ? "weakest" : "overrides lower ranks";
          return `  rank ${rank}/${total} · ${f.title} (${role}) · ${weight} · ${short(f.agentsId)}`;
        })
        .join("\n");

      const sections = found
        .map((f, i) => {
          const rank = i + 1;
          const role = rank === 1 ? "root" : rank === total ? "closest" : "intermediate";
          const weight =
            rank === total
              ? "STRONGEST — overrides all earlier on conflict"
              : rank === 1
                ? "weakest"
                : "overrides earlier ranks";
          return `[PLAYBOOK ${rank}/${total} · governs: ${f.title} (${role}) · precedence: ${weight}]\n${f.markdown}`;
        })
        .join("\n\n");

      const preamble =
        `read_agents_md · target: ${target.title} (${short(pageId)})\n` +
        `${total} playbook${total > 1 ? "s" : ""} govern this target, ordered root→closest. OBEY ALL; on any conflict the CLOSEST (higher rank) wins.\n` +
        `ancestry: ${path}\n${indexLines}`;

      return ok(`${preamble}\n\n${sections}`);
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error));
    }
  },
};
