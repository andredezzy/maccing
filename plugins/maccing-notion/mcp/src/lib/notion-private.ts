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

import { parseCollectionIcons } from "./upsert-property";

const TOKEN_V2 = process.env.NOTION_TOKEN_V2;
const SPACE_ID = process.env.NOTION_SPACE_ID;
const BASE = "https://www.notion.so/api/v3";

// Serialize private POSTs with a minimum interval — Notion's api/v3 bot-protection trips on bursts
// (rapid calls return an HTML page). A shared promise chain spaces every call ≥ MIN apart, so no
// code path (a batch readback, describe, an upsert) can burst-trip it. Transparent to callers.
const MIN_PRIVATE_INTERVAL_MS = 280;
let lastPrivateStart = 0;
let privateGate: Promise<void> = Promise.resolve();

function pacePrivate(): Promise<void> {
  privateGate = privateGate.then(async () => {
    const wait = MIN_PRIVATE_INTERVAL_MS - (Date.now() - lastPrivateStart);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastPrivateStart = Date.now();
  });
  return privateGate;
}

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

/** A single api/v3 POST — paced, with bot-page detection AND network-error capture. Never throws:
 * a connection reset (Notion drops the socket under hard bot-protection) becomes an ok:false result,
 * so every caller handles throttling uniformly instead of seeing a raw fetch error. */
async function rawPost(endpoint: string, body: unknown, activeUser?: string): Promise<PrivateResponse> {
  await pacePrivate();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token_v2=${TOKEN_V2}`,
  };
  if (activeUser) {
    headers["x-notion-active-user-header"] = activeUser;
  }

  let response: Response;
  let raw: string;
  try {
    response = await fetch(`${BASE}/${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
    raw = await response.text();
  } catch (error) {
    return {
      status: 0,
      ok: false,
      body: `Private API unreachable (likely throttled / bot-protection reset): ${error instanceof Error ? error.message : String(error)}`,
    };
  }

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

/** api/v3 POST with bounded paced backoff. The private API throttles via BOTH bot-pages and
 * connection resets; retrying lets a transient throttle self-heal — for reads AND writes. Our
 * private writes are idempotent (icon schema sets), so a retry after an inconclusive reset is safe. */
async function post(endpoint: string, body: unknown, activeUser?: string, tries = 3): Promise<PrivateResponse> {
  let response = await rawPost(endpoint, body, activeUser);
  for (let attempt = 1; attempt < tries && !response.ok; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    response = await rawPost(endpoint, body, activeUser);
  }
  return response;
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

/** Read internal records (e.g. a `collection` schema) — used to verify a private write persisted.
 * Retries with backoff via `post` (the read-back is the bot-throttle-prone half of the private API). */
export async function getRecordValues(requests: RecordRequest[]): Promise<PrivateResponse> {
  return privateCall("getRecordValues", { requests });
}

export interface IconReadOk {
  status: "ok";
  byCollection: Record<string, Record<string, string>>;
}

export interface IconReadThrottled {
  status: "throttled";
}

export type IconRead = IconReadOk | IconReadThrottled;

/**
 * Best-effort read of column icons for one or more collections (the public API can't see them).
 * Returns a DISCRIMINATED result so callers tell "no icons" apart from "read throttled" — never a
 * misleading silent empty. No creds → ok/empty (graceful degrade). Retries the bot-prone read. Never throws.
 */
export async function readCollectionIcons(dataSourceIds: string[]): Promise<IconRead> {
  if (!privateConfig().ok || dataSourceIds.length === 0) {
    return { status: "ok", byCollection: {} };
  }
  try {
    const response = await getRecordValues(dataSourceIds.map((id) => ({ id, table: "collection" })));
    if (!response.ok) {
      return { status: "throttled" };
    }
    return { status: "ok", byCollection: parseCollectionIcons(response.body, dataSourceIds) };
  } catch {
    return { status: "throttled" };
  }
}

export interface PageOrderEntry {
  property: string;
  visible?: boolean;
}

export type PageOrderRead = { status: "ok"; pageProps: PageOrderEntry[] } | { status: "throttled" };

interface CollectionFormatBody {
  results?: { value?: { format?: { collection_page_properties?: PageOrderEntry[] } } }[];
}

/**
 * Read the CANONICAL page-property order (collection.format.collection_page_properties) — the
 * row-detail panel order + per-property default visibility (private; the public API can't see it).
 * Discriminated like readCollectionIcons. An empty array means the collection's page order was never
 * customised (falls back to a default). No creds → ok/empty. Retries the bot-prone read. Never throws.
 */
export async function readCollectionPageProperties(dataSourceId: string): Promise<PageOrderRead> {
  if (!privateConfig().ok) {
    return { status: "ok", pageProps: [] };
  }
  try {
    const response = await getRecordValues([{ id: dataSourceId, table: "collection" }]);
    if (!response.ok) {
      return { status: "throttled" };
    }
    const pageProps = (response.body as CollectionFormatBody).results?.[0]?.value?.format?.collection_page_properties;
    return { status: "ok", pageProps: pageProps ?? [] };
  } catch {
    return { status: "throttled" };
  }
}

/** Merge a patch into the collection's `format` (e.g. collection_page_properties), with the commit op. */
export async function writeCollectionFormat(
  dataSourceId: string,
  formatPatch: Record<string, unknown>,
): Promise<PrivateResponse> {
  const activeUser = await activeUserId();
  const operations = [
    {
      pointer: { table: "collection", id: dataSourceId, spaceId: SPACE_ID },
      command: "update",
      path: ["format"],
      args: formatPatch,
    },
    collectionCommitOp(dataSourceId, activeUser),
  ];
  return saveTransactions(operations);
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
