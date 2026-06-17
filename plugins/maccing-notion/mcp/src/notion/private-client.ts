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

import { errorMessage } from "../tool";

const TOKEN_V2 = process.env.NOTION_TOKEN_V2;
const SPACE_ID = process.env.NOTION_SPACE_ID;
const BASE = "https://www.notion.so/api/v3";

// Serialize private POSTs with a minimum interval — Notion's api/v3 bot-protection trips on bursts
// (rapid calls return an HTML page). A shared promise chain spaces every call ≥ MIN apart, so no
// code path (a batch readback, describe, an upsert) can burst-trip it. Transparent to callers.
const MIN_PRIVATE_INTERVAL_MS = 280;
const BASE_PRIVATE_BACKOFF_MS = 700;

// The FIRST api/v3 call after process start can be met with cold-start bot-protection (a bot-page or a
// connection reset) that lingers for several seconds before the session warms. The session warm-up
// (getSpaces, behind the single-flight activeUserId) gets a bigger, backed-off retry budget than a normal
// call so it OUTLASTS that window instead of giving up — every inline DB's view-order read awaits that one
// call, so if it fails the whole page loses its Notion view order at once (the Muscle Groups gallery → table
// flake). Backing off (not bursting) is also the correct anti-bot behavior. 5 attempts ≈ up to 7s of patience.
export const WARMUP_RETRIES = 5;

let lastPrivateStart = 0;
let privateGate: Promise<void> = Promise.resolve();

async function pacePrivate(): Promise<void> {
  privateGate = privateGate.then(async () => {
    const delayMs = MIN_PRIVATE_INTERVAL_MS - (Date.now() - lastPrivateStart);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    lastPrivateStart = Date.now();
  });
  return privateGate;
}

interface PrivateResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

interface PrivateConfigStatus {
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
async function postOnce(endpoint: string, body: unknown, activeUser?: string): Promise<PrivateResponse> {
  await pacePrivate();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token_v2=${TOKEN_V2}`,
  };
  if (activeUser) {
    headers["x-notion-active-user-header"] = activeUser;
  }

  let response: Response;
  let responseText: string;
  try {
    response = await fetch(`${BASE}/${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
    responseText = await response.text();
  } catch (error) {
    return {
      status: 0,
      ok: false,
      body: `Private API unreachable (likely throttled / bot-protection reset): ${errorMessage(error)}`,
    };
  }

  let responseBody: unknown;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    return {
      status: response.status,
      ok: false,
      body: `Non-JSON response (likely rate-limited / bot page — space out private calls and retry). First bytes: ${responseText.slice(0, 120)}`,
    };
  }

  return { status: response.status, ok: response.ok, body: responseBody };
}

/** Retry a private call until it succeeds or the budget runs out, backing off (linearly, never bursting)
 * between attempts so a transient throttle — bot-page or connection reset — can self-heal. Pure: the caller
 * supplies the attempt thunk, so the cold-start window is testable without a live socket. */
export async function retryPrivate(
  attempt: () => Promise<PrivateResponse>,
  maxRetries: number,
): Promise<PrivateResponse> {
  let response = await attempt();
  for (let retries = 1; retries < maxRetries && !response.ok; retries++) {
    await new Promise((resolve) => setTimeout(resolve, BASE_PRIVATE_BACKOFF_MS * retries));
    response = await attempt();
  }
  return response;
}

/** api/v3 POST with bounded paced backoff. The private API throttles via BOTH bot-pages and
 * connection resets; retrying lets a transient throttle self-heal — for reads AND writes. Our
 * private writes are idempotent (icon schema sets), so a retry after an inconclusive reset is safe. */
async function postWithRetry(
  endpoint: string,
  body: unknown,
  activeUser?: string,
  maxRetries = 3,
): Promise<PrivateResponse> {
  return retryPrivate(() => postOnce(endpoint, body, activeUser), maxRetries);
}

interface GetSpacesUserRecord {
  space?: Record<string, unknown>;
}

async function resolveActiveUser(): Promise<string> {
  if (!SPACE_ID) {
    throw new Error("NOTION_SPACE_ID is not set.");
  }

  // getSpaces is the session warm-up — the universal first private call. Give it the patient cold-start
  // budget so a transient bot window can't cascade into every awaiting view-order read returning null.
  const response = await postWithRetry("getSpaces", {}, undefined, WARMUP_RETRIES);
  if (!response.ok || typeof response.body !== "object" || response.body === null) {
    throw new Error(
      `getSpaces failed (status ${response.status}). Is NOTION_TOKEN_V2 the .app.notion.com (broad-domain) cookie?`,
    );
  }

  const usersById = response.body as Record<string, GetSpacesUserRecord>;
  const owningUserId = Object.entries(usersById).find(([, record]) => record.space && SPACE_ID in record.space)?.[0];

  if (!owningUserId) {
    const availableSpaces = Object.values(usersById)
      .flatMap((record) => Object.keys(record.space ?? {}))
      .join(", ");
    throw new Error(
      `No user in this session owns NOTION_SPACE_ID ${SPACE_ID}. Available spaces: ${availableSpaces || "(none)"}.`,
    );
  }

  return owningUserId;
}

// Cached as a PROMISE singleton: getSpaces is a network call, the input is unavailable at
// call-time, and every private write needs the result. Caching the promise (not the value)
// dedups concurrent callers — an agent loop fires tools near-simultaneously, so a plain value
// cache would let several race and the loser's error could clobber the winner's result. Cleared
// on failure so the next caller retries.
let activeUserIdRequest: Promise<string> | undefined;

/** The account that owns NOTION_SPACE_ID (a session can hold multiple), for the active-user header. */
export function activeUserId(): Promise<string> {
  if (!activeUserIdRequest) {
    activeUserIdRequest = resolveActiveUser().catch((error) => {
      activeUserIdRequest = undefined;
      throw error;
    });
  }
  return activeUserIdRequest;
}

/** Generic api/v3 call with the active-user header injected (getSpaces, getRecordValues, …). */
export async function privateCall(endpoint: string, body: unknown): Promise<PrivateResponse> {
  return postWithRetry(endpoint, body, await activeUserId());
}

/** saveTransactions: caller supplies the full operations[] (including any trailing commit op). */
export async function saveTransactions(operations: unknown[]): Promise<PrivateResponse> {
  const activeUser = await activeUserId();
  const envelope = {
    requestId: crypto.randomUUID(),
    transactions: [{ id: crypto.randomUUID(), spaceId: SPACE_ID, operations }],
  };
  return postWithRetry("saveTransactions", envelope, activeUser);
}

interface RecordRequest {
  id: string;
  table: string;
}

/** Read internal records (e.g. a `collection` schema) — used to verify a private write persisted.
 * Retries with backoff via `postWithRetry` (the read-back is the bot-throttle-prone half of the private API). */
async function getRecordValues(requests: RecordRequest[]): Promise<PrivateResponse> {
  return privateCall("getRecordValues", { requests });
}

interface GetRecordValuesBlockBody {
  results?: { value?: { view_ids?: string[] } }[];
}

/**
 * Read a collection_view container's ordered `view_ids` (the real tab order; `view_ids[0]` is the default
 * view). The public API exposes no view order or default-view signal, so this is the only source of truth.
 * No creds / failure → null (graceful: the caller falls back to public order). Never throws.
 */
export async function readViewOrder(blockId: string): Promise<string[] | null> {
  if (!privateConfig().ok) {
    return null;
  }
  try {
    const response = await getRecordValues([{ id: blockId, table: "block" }]);
    if (!response.ok) {
      return null;
    }
    const body = response.body as GetRecordValuesBlockBody;
    const viewIds = body.results?.[0]?.value?.view_ids;
    return Array.isArray(viewIds) && viewIds.length > 0 ? viewIds : null;
  } catch (error) {
    // Non-fatal: callers treat null as "no private view order" and fall back to the public list.
    // Log so a genuine failure is distinguishable from a legitimately-absent order (CLAUDE.md: never swallow).
    console.error("readViewOrder failed:", error);
    return null;
  }
}

/** Outcome of a best-effort private read — distinguishes a real empty from a throttled/failed read. */
export enum ReadStatus {
  OK = "OK",
  THROTTLED = "THROTTLED",
}

const THROTTLE_SIGNATURE =
  /throttl|bot.?page|bot-protection|rate.?limit|unreachable|connection|socket|closed unexpectedly|non-json|hang up/i;

/**
 * Turn a failed private-API body into a user-facing message. A connection reset / bot page is the
 * session's bot-protection, NOT a real failure — say so and reassure that the public schema/value
 * changes already landed. A genuine API error (a JSON validation body) is surfaced, not masked.
 */
export function describePrivateFailure(body: unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (THROTTLE_SIGNATURE.test(text)) {
    return "private app API throttled (bot protection) — column icons not applied (any public schema/value changes in this batch are listed under `applied`); retry the icon entries in a moment.";
  }
  return `private write failed: ${text.slice(0, 300)}`;
}

interface IconReadOk {
  status: ReadStatus.OK;
  byCollection: Record<string, Record<string, string>>;
}

interface IconReadThrottled {
  status: ReadStatus.THROTTLED;
}

export type IconRead = IconReadOk | IconReadThrottled;

interface GetRecordValuesCollectionBody {
  results?: { value?: { schema?: Record<string, { icon?: string }> } }[];
}

/** Parse a getRecordValues collection read into { dataSourceId → { rawPropertyId → iconAsset } }. */
export function parseCollectionIcons(body: unknown, dataSourceIds: string[]): Record<string, Record<string, string>> {
  const results = (body as GetRecordValuesCollectionBody).results ?? [];
  const byCollection: Record<string, Record<string, string>> = {};

  dataSourceIds.forEach((dataSourceId, index) => {
    const schema = results[index]?.value?.schema ?? {};
    const icons: Record<string, string> = {};
    for (const [propertyId, definition] of Object.entries(schema)) {
      if (definition?.icon) {
        icons[propertyId] = definition.icon;
      }
    }
    byCollection[dataSourceId] = icons;
  });

  return byCollection;
}

/**
 * Best-effort read of column icons for one or more collections (the public API can't see them).
 * Returns a DISCRIMINATED result so callers tell "no icons" apart from "read throttled" — never a
 * misleading silent empty. No creds → ok/empty (graceful degrade). Retries the bot-prone read. Never throws.
 */
export async function readCollectionIcons(dataSourceIds: string[]): Promise<IconRead> {
  if (!privateConfig().ok || dataSourceIds.length === 0) {
    return { status: ReadStatus.OK, byCollection: {} };
  }
  try {
    const response = await getRecordValues(dataSourceIds.map((id) => ({ id, table: "collection" })));
    if (!response.ok) {
      return { status: ReadStatus.THROTTLED };
    }
    return { status: ReadStatus.OK, byCollection: parseCollectionIcons(response.body, dataSourceIds) };
  } catch (error) {
    // Transform to THROTTLED so callers degrade gracefully — but log, so a genuine bug isn't masked as a throttle.
    console.error("readCollectionIcons failed:", error);
    return { status: ReadStatus.THROTTLED };
  }
}

export interface PageOrderEntry {
  property: string;
  visible?: boolean;
}

interface PageOrderReadOk {
  status: ReadStatus.OK;
  pageProperties: PageOrderEntry[];
}

interface PageOrderReadThrottled {
  status: ReadStatus.THROTTLED;
}

type PageOrderRead = PageOrderReadOk | PageOrderReadThrottled;

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
    return { status: ReadStatus.OK, pageProperties: [] };
  }
  try {
    const response = await getRecordValues([{ id: dataSourceId, table: "collection" }]);
    if (!response.ok) {
      return { status: ReadStatus.THROTTLED };
    }
    const pageProperties = (response.body as CollectionFormatBody).results?.[0]?.value?.format
      ?.collection_page_properties;
    return { status: ReadStatus.OK, pageProperties: pageProperties ?? [] };
  } catch (error) {
    // Transform to THROTTLED so callers degrade gracefully — but log, so a genuine bug isn't masked as a throttle.
    console.error("readCollectionPageProperties failed:", error);
    return { status: ReadStatus.THROTTLED };
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
function collectionCommitOp(dataSourceId: string, activeUser: string): Record<string, unknown> {
  return {
    pointer: { table: "collection", id: dataSourceId, spaceId: SPACE_ID },
    path: [],
    command: "update",
    args: { last_edited_by_id: activeUser, last_edited_by_table: "notion_user" },
  };
}
