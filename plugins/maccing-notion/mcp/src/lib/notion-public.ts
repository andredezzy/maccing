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

  const response = await fetch(url, init);
  const raw = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  return { status: response.status, ok: response.ok, body: payload };
}
