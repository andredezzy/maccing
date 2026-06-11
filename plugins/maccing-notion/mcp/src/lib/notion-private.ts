// Private Notion APP API client (www.notion.so/api/v3) — the escape hatch for UI-only features
// the public API can't touch (database property/column icons, UI relative filters, …).
//
// UNOFFICIAL + session-cookie auth + undocumented + rate-limited. The cookie lives ONLY in this
// server process (NOTION_TOKEN_V2), never exposed to the agent. See skill references/private-api.md.
//
// Auth specifics (live-verified 2026-06-11):
//  - NOTION_TOKEN_V2 must be the BROAD-DOMAIN `.app.notion.com` token_v2 cookie. The exact-host
//    `app.notion.com` cookie is a different value and is rejected 401.
//  - x-notion-active-user-header must be the account (a session can hold several) that has edit
//    access to NOTION_SPACE_ID — resolved from getSpaces by matching the space, then cached.

const TOKEN_V2 = process.env.NOTION_TOKEN_V2;
const SPACE_ID = process.env.NOTION_SPACE_ID;
const BASE = "https://www.notion.so/api/v3";

export interface PrivateResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface PrivateConfigStatus {
  ok: boolean;
  missing: string[];
}

export function privateConfig(): PrivateConfigStatus {
  const missing: string[] = [];
  if (!TOKEN_V2) {
    missing.push("NOTION_TOKEN_V2");
  }
  if (!SPACE_ID) {
    missing.push("NOTION_SPACE_ID");
  }
  return { ok: missing.length === 0, missing };
}

export function spaceId(): string | undefined {
  return SPACE_ID;
}

/** Low-level POST to api/v3 with cookie auth. Detects the bot/HTML page returned when rate-limited. */
async function post(endpoint: string, body: unknown, activeUser?: string): Promise<PrivateResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token_v2=${TOKEN_V2}`,
  };
  if (activeUser) {
    headers["x-notion-active-user-header"] = activeUser;
  }

  const response = await fetch(`${BASE}/${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return {
      status: response.status,
      ok: false,
      body: `Non-JSON response (likely rate-limited / bot page — space out private calls and retry). First bytes: ${raw.slice(0, 120)}`,
    };
  }

  return { status: response.status, ok: response.ok, body: payload };
}

interface GetSpacesUserRecord {
  space?: Record<string, unknown>;
}

async function resolveActiveUser(): Promise<string> {
  if (!SPACE_ID) {
    throw new Error("NOTION_SPACE_ID is not set.");
  }

  const response = await post("getSpaces", {});
  if (!response.ok || typeof response.body !== "object" || response.body === null) {
    throw new Error(
      `getSpaces failed (status ${response.status}). Is NOTION_TOKEN_V2 the .app.notion.com (broad-domain) cookie?`,
    );
  }

  const usersById = response.body as Record<string, GetSpacesUserRecord>;
  const owningUser = Object.entries(usersById).find(([, record]) => record.space && SPACE_ID in record.space)?.[0];
  const userId = owningUser ?? Object.keys(usersById)[0];

  if (!userId) {
    throw new Error("Could not resolve an active user from getSpaces.");
  }
  return userId;
}

// Cached as a PROMISE singleton: getSpaces is a network call, the input is unavailable at
// call-time, and every private write needs the result. Caching the promise (not the value)
// dedups concurrent callers — an agent loop fires tools near-simultaneously, so a plain value
// cache would let several race and the loser's error could clobber the winner's result. Cleared
// on failure so the next caller retries.
let inflightActiveUser: Promise<string> | undefined;

/** The account that owns NOTION_SPACE_ID (a session can hold multiple), for the active-user header. */
export function activeUserId(): Promise<string> {
  if (!inflightActiveUser) {
    inflightActiveUser = resolveActiveUser().catch((error) => {
      inflightActiveUser = undefined;
      throw error;
    });
  }
  return inflightActiveUser;
}

/** Generic api/v3 call with the active-user header injected (getSpaces, getRecordValues, …). */
export async function privateCall(endpoint: string, body: unknown): Promise<PrivateResponse> {
  return post(endpoint, body, await activeUserId());
}

/** saveTransactions: caller supplies the full operations[] (including any trailing commit op). */
export async function saveTransactions(operations: unknown[]): Promise<PrivateResponse> {
  const activeUser = await activeUserId();
  const envelope = {
    requestId: crypto.randomUUID(),
    transactions: [{ id: crypto.randomUUID(), spaceId: SPACE_ID, operations }],
  };
  return post("saveTransactions", envelope, activeUser);
}

export interface RecordRequest {
  id: string;
  table: string;
}

/** Read internal records (e.g. a `collection` schema) — used to verify a private write persisted. */
export async function getRecordValues(requests: RecordRequest[]): Promise<PrivateResponse> {
  return privateCall("getRecordValues", { requests });
}

/**
 * Commit op required after any schema mutation: without this trailing `update` bumping the
 * collection's editor, saveTransactions returns 200 but silently does NOT persist.
 */
export function collectionCommitOp(dataSourceId: string, activeUser: string): Record<string, unknown> {
  return {
    pointer: { table: "collection", id: dataSourceId, spaceId: SPACE_ID },
    path: [],
    command: "update",
    args: { last_edited_by_id: activeUser, last_edited_by_table: "notion_user" },
  };
}
