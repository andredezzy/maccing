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

// Pacing + ADAPTIVE backoff for Notion's api/v3 bot-protection. The private API trips on bursts (an HTML
// bot-page or a dropped socket) AND the trip is STATEFUL — once hot it stays hot for tens of seconds, so
// retrying or firing another private call too soon just re-trips and ESCALATES it (the failure that needed
// a ~60s manual wait to clear). Two transparent layers defend against it:
//   1. MIN_PRIVATE_INTERVAL_MS — a floor between calls so nothing bursts; and
//   2. an ADAPTIVE COOLDOWN — each throttle pushes a GLOBAL "don't call until" forward, growing
//      exponentially per consecutive throttle (capped) and clearing on the first success. The gate is a
//      module-level promise chain, so EVERY path — a retry, a batch readback, a concurrent OR separate tool
//      call — waits it out; a trip self-heals across calls instead of cascading. Backing off (not bursting)
//      is also the correct anti-bot behavior.
const MIN_PRIVATE_INTERVAL_MS = 280;
const THROTTLE_COOLDOWN_BASE_MS = 1_000;
const THROTTLE_COOLDOWN_CAP_MS = 30_000;

// A failed private response is bot-protection (a throttle), NOT a real error, when it carries a 0/429/503
// status or one of these body markers. Drives both the cooldown growth and the user-facing message.
const THROTTLE_SIGNATURE =
  /throttl|bot.?page|bot-protection|rate.?limit|unreachable|connection|socket|closed unexpectedly|non-json|hang up/i;

// The FIRST api/v3 call after process start can meet cold-start bot-protection (a bot-page or connection
// reset) that lingers a few seconds. The session warm-up (getSpaces, behind the single-flight
// activeUserId) gets a bigger retry budget than a normal call so it OUTLASTS that window instead of giving
// up — every inline DB's view-order read awaits that one call, so if it fails the whole page loses its
// Notion view order at once (the Muscle Groups gallery → table flake). With the exponential cooldown, 5
// attempts ride out a multi-second cold start (≈ 1 + 2 + 4 + 8s of patience).
export const WARMUP_RETRIES = 5;

let lastPrivateStart = 0;
let privateGate: Promise<void> = Promise.resolve();
// Adaptive throttle state (see the pacing comment): the gate won't release a call before cooldownUntil,
// and each consecutive throttle grows that window; the first success clears it.
let cooldownUntil = 0;
let consecutiveThrottles = 0;

/** A failed private response is a THROTTLE (vs a genuine API error) when the transport dropped (status 0),
 * Notion returned 429/503, or the body is a bot-page / rate-limit marker. A JSON validation error (bad
 * args, no edit access, …) is NOT a throttle, so it never grows the cooldown. Pure → unit-tested. */
export function isThrottle(response: PrivateResponse): boolean {
  if (response.ok) {
    return false;
  }
  if (response.status === 0 || response.status === 429 || response.status === 503) {
    return true;
  }
  const text = typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "");
  return THROTTLE_SIGNATURE.test(text);
}

/** The cooldown (ms) imposed after the Nth consecutive throttle (1-based) — exponential, capped. Jitter is
 * layered on by the caller, so this stays pure/testable. */
export function throttleCooldownMs(consecutive: number): number {
  return Math.min(THROTTLE_COOLDOWN_CAP_MS, THROTTLE_COOLDOWN_BASE_MS * 2 ** Math.max(0, consecutive - 1));
}

/** Fold one private response into the global throttle state: a throttle pushes the cooldown forward
 * (exponential + jitter); the first OK clears it; a genuine non-throttle error is neutral. */
function noteOutcome(response: PrivateResponse): void {
  if (isThrottle(response)) {
    consecutiveThrottles += 1;
    const backoff = throttleCooldownMs(consecutiveThrottles);
    cooldownUntil = Date.now() + backoff + Math.floor(Math.random() * (backoff / 4));
  } else if (response.ok) {
    consecutiveThrottles = 0;
    cooldownUntil = 0;
  }
}

async function pacePrivate(): Promise<void> {
  privateGate = privateGate.then(async () => {
    const readyAt = Math.max(lastPrivateStart + MIN_PRIVATE_INTERVAL_MS, cooldownUntil);
    const delayMs = readyAt - Date.now();
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

/** Perform one api/v3 POST — bot-page detection AND network-error capture, never throws: a connection
 * reset (Notion drops the socket under hard bot-protection) becomes an ok:false result, so every caller
 * handles throttling uniformly instead of seeing a raw fetch error. Pacing + cooldown live in postOnce. */
async function performPost(endpoint: string, body: unknown, activeUser?: string): Promise<PrivateResponse> {
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

/** A single api/v3 POST: paced behind the shared gate (min-interval + adaptive cooldown), then the
 * response folded back into the throttle state (noteOutcome). Transparent to callers; never throws. */
async function postOnce(endpoint: string, body: unknown, activeUser?: string): Promise<PrivateResponse> {
  await pacePrivate();
  const response = await performPost(endpoint, body, activeUser);
  noteOutcome(response);
  return response;
}

/** Retry a private call until it succeeds or the budget runs out. Spacing between attempts is the shared
 * gate's job, NOT a separate backoff here: each throttled attempt grows the adaptive cooldown (noteOutcome)
 * that the next attempt's pacePrivate waits out — so backoff has ONE source of truth and a trip self-heals
 * across attempts AND across separate calls. Pure: the caller supplies the thunk, so the budget is testable
 * without a live socket. */
export async function retryPrivate(
  attempt: () => Promise<PrivateResponse>,
  maxRetries: number,
): Promise<PrivateResponse> {
  let response = await attempt();
  for (let retries = 1; retries < maxRetries && !response.ok; retries++) {
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

/**
 * Turn a failed private-API body into a user-facing message. A connection reset / bot page is the
 * session's bot-protection, NOT a real failure — say so and reassure that the public schema/value
 * changes already landed. A genuine API error (a JSON validation body) is surfaced, not masked.
 */
export function describePrivateFailure(body: unknown): string {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (THROTTLE_SIGNATURE.test(text)) {
    return "private app API throttled (bot protection) — this UI-only change didn't apply. The client now self-throttles and backs off automatically, so just retry in a moment (any public schema/value changes in the same batch already landed).";
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
