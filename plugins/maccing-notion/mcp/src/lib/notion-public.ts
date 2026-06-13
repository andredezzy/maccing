// Public Notion REST API client (api.notion.com). Auth via NOTION_TOKEN (integration secret).

const TOKEN = process.env.NOTION_TOKEN;
const BASE = "https://api.notion.com";

export const VERSION = process.env.NOTION_VERSION ?? "2026-03-11";

export interface PublicResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

export function hasPublicToken(): boolean {
  return Boolean(TOKEN);
}

// Idempotent HTTP methods — safe to retry on 502 (gateway error that did not process the request).
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD"]);

/**
 * Return true when the HTTP status + method combination warrants a retry.
 *
 * Rules (mirroring the private client's references/patterns.md):
 *   429  — rate-limited: always retry (the request was NOT processed).
 *   503  — service unavailable: always retry (the request was NOT processed).
 *   502  — bad gateway: retry ONLY for idempotent methods (GET/HEAD) because a 502 on a
 *          write (POST/PATCH/DELETE) could mean the request WAS processed, so retrying
 *          could double-apply it.
 *   2xx  — success: never retry.
 *   other 4xx (400/401/403/404/409/…) — client error: never retry.
 */
export function shouldRetryPublic(status: number, method: string): boolean {
  const verb = method.toUpperCase();

  if (status === 429 || status === 503) {
    return true;
  }

  if (status === 502) {
    return IDEMPOTENT_METHODS.has(verb);
  }

  return false;
}

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 700;

/** Backoff before the next retry: EXPONENTIAL (700 · 2^attempt = 700, 1400, 2800 ms), unless a positive
 * Retry-After (seconds, from the response header) overrides it. */
export function backoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return BASE_BACKOFF_MS * 2 ** attempt;
}

export async function publicRequest(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<PublicResponse> {
  const verb = method.toUpperCase();

  let url = BASE + path;
  if (query && typeof query === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      params.append(key, String(value));
    }
    const queryString = params.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    "Notion-Version": VERSION,
  };

  const init: RequestInit = { method: verb, headers };
  if (body !== undefined && verb !== "GET" && verb !== "DELETE") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let lastResponse: PublicResponse = { status: 0, ok: false, body: null };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, init);

    const raw = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }

    lastResponse = { status: response.status, ok: response.ok, body: payload };

    if (!shouldRetryPublic(response.status, verb)) {
      return lastResponse;
    }

    // No more attempts left — return the last response as-is.
    if (attempt >= MAX_ATTEMPTS - 1) {
      break;
    }

    // Exponential backoff, unless the response's Retry-After (seconds) overrides it.
    const retryAfterRaw = response.headers.get("Retry-After");
    const waitMs = backoffMs(attempt, retryAfterRaw !== null ? Number(retryAfterRaw) : undefined);

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  return lastResponse;
}
